'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '../../lib/supabase-server';

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
      visible,
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

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await requireUser();
  await supabase.from('products').delete().eq('id', id);
  revalidatePath('/admin/products');
  revalidatePath('/');
}

export async function toggleVisibility(id: string, visible: boolean): Promise<void> {
  const supabase = await requireUser();
  await supabase.from('products').update({ visible }).eq('id', id);
  revalidatePath('/admin/products');
  revalidatePath('/');
}
