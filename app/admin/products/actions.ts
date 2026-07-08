'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '../../lib/supabase-server';
import { createServiceClient } from '../../lib/supabase';
import { MAX_PRODUCT_PHOTOS, MAX_PHOTO_BYTES } from '../../data/types';

const BUCKET = 'product-images';

async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith('image/')) return { error: 'Please choose an image file (JPG, PNG, etc.).' };
  if (file.size > MAX_PHOTO_BYTES) return { error: 'Image must be under 8MB.' };

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `products/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { error: `Image upload failed: ${error.message}` };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

export interface ProductFormState {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  return supabase;
}

async function parseProduct(formData: FormData): Promise<
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; state: ProductFormState }
> {
  const name = str(formData, 'name');
  const description = str(formData, 'description');
  const priceRaw = str(formData, 'price');
  const categorySlug = str(formData, 'category_slug');
  let subcategorySlug: string | null = str(formData, 'subcategory_slug') || null;
  const colourSlug: string | null = str(formData, 'colour_slug') || null;
  const visible = formData.get('visible') != null;
  const soldOut = formData.get('sold_out') != null;

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Please enter a name.';
  const price = Number(priceRaw);
  if (!priceRaw) fieldErrors.price = 'Please enter a price.';
  else if (!Number.isFinite(price) || price < 0) fieldErrors.price = 'Enter a valid price (0 or more).';
  if (!categorySlug) fieldErrors.category_slug = 'Please choose a category.';

  // Subcategories only apply to Earrings.
  if (categorySlug !== 'earrings') subcategorySlug = null;

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: { status: 'error', message: 'Please check the highlighted fields.', fieldErrors } };
  }

  // Derive the placeholder tint from the chosen colour (or a default).
  const supabase = await createServerSupabase();
  let accentColor = '#B5865A';
  if (colourSlug) {
    const { data: colour } = await supabase.from('colours').select('hex').eq('slug', colourSlug).maybeSingle();
    if (colour?.hex) accentColor = colour.hex;
  }

  // Photos: an ordered token list ('image_order') plus the new files ('new_image').
  // Each token is either an existing public URL (kept) or 'new:i' (upload newFiles[i]).
  const orderRaw = str(formData, 'image_order');
  let order: string[] = [];
  if (orderRaw) {
    try {
      const parsed = JSON.parse(orderRaw);
      if (Array.isArray(parsed)) order = parsed.filter((t): t is string => typeof t === 'string');
    } catch {
      order = [];
    }
  }
  // Keep every appended File (no size pre-filter) so newFiles stays positionally
  // aligned with the client's `new:i` tokens; uploadImage validates each one.
  const newFiles = formData.getAll('new_image').filter((f): f is File => f instanceof File);

  if (order.length > MAX_PRODUCT_PHOTOS) {
    return {
      ok: false,
      state: { status: 'error', message: `You can add up to ${MAX_PRODUCT_PHOTOS} photos.` },
    };
  }

  // Upload all new files concurrently — they map positionally to the client's
  // `new:i` tokens. Bail on the first failure.
  const uploads = await Promise.all(newFiles.map((f) => uploadImage(f)));
  const failed = uploads.find((r) => 'error' in r);
  if (failed && 'error' in failed) {
    return { ok: false, state: { status: 'error', message: failed.error } };
  }

  // Assemble the ordered gallery: existing URLs kept as-is, new files resolved to
  // their uploaded URL by index. (Owner-only action, so existing tokens are trusted.)
  const imageUrls: string[] = [];
  for (const token of order) {
    if (token.startsWith('new:')) {
      const uploaded = uploads[Number(token.slice(4))];
      if (uploaded && 'url' in uploaded) imageUrls.push(uploaded.url);
    } else {
      imageUrls.push(token);
    }
  }
  const imageUrl = imageUrls[0] ?? null;

  return {
    ok: true,
    values: {
      name,
      description,
      price,
      category_slug: categorySlug,
      subcategory_slug: subcategorySlug,
      colour_slug: colourSlug,
      accent_color: accentColor,
      image_url: imageUrl,
      image_urls: imageUrls,
      visible,
      sold_out: soldOut,
    },
  };
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const supabase = await requireUser();
  const parsed = await parseProduct(formData);
  if (!parsed.ok) return parsed.state;

  // Place new product at the end.
  const { data: last } = await supabase
    .from('products')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? 0) + 1;

  const { error } = await supabase.from('products').insert({ ...parsed.values, sort_order: sortOrder });
  if (error) {
    return { status: 'error', message: `Could not save: ${error.message}` };
  }

  revalidatePath('/admin/products');
  revalidatePath('/');
  redirect('/admin/products');
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const supabase = await requireUser();
  const parsed = await parseProduct(formData);
  if (!parsed.ok) return parsed.state;

  const { error } = await supabase
    .from('products')
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    return { status: 'error', message: `Could not save: ${error.message}` };
  }

  revalidatePath('/admin/products');
  revalidatePath('/');
  revalidatePath(`/product/${id}`);
  redirect('/admin/products');
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return { error: `Could not delete: ${error.message}` };
  revalidatePath('/admin/products');
  revalidatePath('/');
  return {};
}

export async function toggleVisibility(id: string, visible: boolean): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase.from('products').update({ visible }).eq('id', id);
  if (error) return { error: `Could not update: ${error.message}` };
  revalidatePath('/admin/products');
  revalidatePath('/');
  return {};
}

export async function toggleSoldOut(id: string, soldOut: boolean): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase.from('products').update({ sold_out: soldOut }).eq('id', id);
  if (error) return { error: `Could not update: ${error.message}` };
  revalidatePath('/admin/products');
  revalidatePath('/');
  revalidatePath(`/product/${id}`);
  return {};
}

export async function duplicateProduct(id: string): Promise<{ id?: string; error?: string }> {
  const supabase = await requireUser();

  const { data: source, error: readError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (readError || !source) {
    return { error: `Could not load the product: ${readError?.message ?? 'not found'}` };
  }

  const { data: last } = await supabase
    .from('products')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  // The copy shares photo URLs (nothing ever deletes storage files, so that is
  // safe) and stays hidden until the owner has renamed and reviewed it.
  const { data: created, error } = await supabase
    .from('products')
    .insert({
      name: `${source.name} (copy)`,
      description: source.description,
      price: source.price,
      category_slug: source.category_slug,
      subcategory_slug: source.subcategory_slug,
      colour_slug: source.colour_slug,
      accent_color: source.accent_color,
      image_url: source.image_url,
      image_urls: source.image_urls,
      visible: false,
      sold_out: source.sold_out,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select('id')
    .single();
  if (error || !created) {
    return { error: `Could not duplicate: ${error?.message ?? 'no row returned'}` };
  }

  revalidatePath('/admin/products');
  return { id: created.id };
}
