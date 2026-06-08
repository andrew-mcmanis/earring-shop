'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '../../lib/supabase-server';

export interface LabelResult {
  ok: boolean;
  error?: string;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

async function requireUser(): Promise<SupabaseClient> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authorised.');
  return supabase;
}

async function uniqueSlug(
  supabase: SupabaseClient,
  table: string,
  base: string,
): Promise<string> {
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await supabase.from(table).select('slug').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${n++}`;
  }
}

function refresh() {
  revalidatePath('/admin/labels');
  revalidatePath('/');
}

async function nextSortOrder(supabase: SupabaseClient, table: string): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? 0) + 1;
}

// ── Categories ──────────────────────────────────────────────
export async function createCategory(name: string): Promise<LabelResult> {
  const supabase = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'Please enter a name.' };
  const slug = await uniqueSlug(supabase, 'categories', slugify(clean));
  const { error } = await supabase
    .from('categories')
    .insert({ slug, name: clean, sort_order: await nextSortOrder(supabase, 'categories') });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function renameCategory(slug: string, name: string): Promise<LabelResult> {
  const supabase = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'Please enter a name.' };
  const { error } = await supabase.from('categories').update({ name: clean }).eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteCategory(slug: string): Promise<LabelResult> {
  const supabase = await requireUser();
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_slug', slug);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `In use by ${count} product${count === 1 ? '' : 's'} — move or remove those first.`,
    };
  }
  const { error } = await supabase.from('categories').delete().eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ── Subcategories ───────────────────────────────────────────
export async function createSubcategory(name: string, categorySlug: string): Promise<LabelResult> {
  const supabase = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'Please enter a name.' };
  if (!categorySlug) return { ok: false, error: 'Please choose a parent category.' };
  const slug = await uniqueSlug(supabase, 'subcategories', slugify(clean));
  const { error } = await supabase.from('subcategories').insert({
    slug,
    name: clean,
    category_slug: categorySlug,
    sort_order: await nextSortOrder(supabase, 'subcategories'),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function renameSubcategory(slug: string, name: string): Promise<LabelResult> {
  const supabase = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'Please enter a name.' };
  const { error } = await supabase.from('subcategories').update({ name: clean }).eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteSubcategory(slug: string): Promise<LabelResult> {
  const supabase = await requireUser();
  // products.subcategory_slug is ON DELETE SET NULL, so this is always safe.
  const { error } = await supabase.from('subcategories').delete().eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ── Colours ─────────────────────────────────────────────────
export async function createColour(name: string, hex: string): Promise<LabelResult> {
  const supabase = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'Please enter a name.' };
  if (!HEX_RE.test(hex)) return { ok: false, error: 'Please choose a colour.' };
  const slug = await uniqueSlug(supabase, 'colours', slugify(clean));
  const { error } = await supabase.from('colours').insert({ slug, name: clean, hex });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function updateColour(slug: string, name: string, hex: string): Promise<LabelResult> {
  const supabase = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, error: 'Please enter a name.' };
  if (!HEX_RE.test(hex)) return { ok: false, error: 'Please choose a colour.' };
  const { error } = await supabase.from('colours').update({ name: clean, hex }).eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteColour(slug: string): Promise<LabelResult> {
  const supabase = await requireUser();
  // products.colour_slug is ON DELETE SET NULL, so this is always safe.
  const { error } = await supabase.from('colours').delete().eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
