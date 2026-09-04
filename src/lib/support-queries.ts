import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { signMediaMany } from '@/lib/signed-urls';

function one<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}


export interface RecipeCard {
  id: string; name: string; category: string; description: string;
  prep: number | null; cook: number | null; difficulty: string; servings: number | null;
  cover: string | null;
}

export async function getRecipes(familyId: string): Promise<RecipeCard[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('recipes')
    .select('id, name, category, description, prep_minutes, cook_minutes, difficulty, servings, cover_path')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });
  const rows = data ?? [];
  const covers = await signMediaMany(rows.map((r) => r.cover_path));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? 'other',
    description: r.description ?? '',
    prep: r.prep_minutes,
    cook: r.cook_minutes,
    difficulty: r.difficulty ?? 'easy',
    servings: r.servings,
    cover: r.cover_path ? covers.get(r.cover_path) ?? null : null,
  }));
}

export interface RecipeDetail extends RecipeCard {
  ingredients: string[];
  steps: { id: string; no: number; body: string; image: string | null }[];
  audio: { id: string; url: string | null; duration: number | null }[];
  photos: { id: string; url: string | null; caption: string | null }[];
}

export async function getRecipe(id: string): Promise<RecipeDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: r } = await supabase
    .from('recipes')
    .select('id, name, category, description, prep_minutes, cook_minutes, difficulty, servings, cover_path, ingredients:recipe_ingredients(text, sort_order), steps:recipe_steps(id, step_no, body, image_path), audio:support_audio(id, storage_path, duration_sec), media:recipe_media(id, storage_path, caption, sort_order)')
    .eq('id', id)
    .maybeSingle();
  if (!r) return null;

  const stepRows = ((r.steps as { id: string; step_no: number; body: string; image_path: string | null }[]) ?? [])
    .sort((a, b) => a.step_no - b.step_no);
  const audioRows = ((r.audio as { id: string; storage_path: string; duration_sec: number | null }[]) ?? []);
  const mediaRows = ((r.media as { id: string; storage_path: string; caption: string | null; sort_order: number }[]) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order);

  // Cover, step images, voice notes and photos — all signed in one request.
  const urls = await signMediaMany([
    r.cover_path,
    ...stepRows.map((s) => s.image_path),
    ...audioRows.map((a) => a.storage_path),
    ...mediaRows.map((m) => m.storage_path),
  ]);
  const steps = stepRows.map((s) => ({ id: s.id, no: s.step_no, body: s.body, image: s.image_path ? urls.get(s.image_path) ?? null : null }));
  const audio = audioRows.map((a) => ({ id: a.id, url: urls.get(a.storage_path) ?? null, duration: a.duration_sec }));
  const photos = mediaRows.map((m) => ({ id: m.id, url: urls.get(m.storage_path) ?? null, caption: m.caption }));

  return {
    id: r.id,
    name: r.name,
    category: r.category ?? 'other',
    description: r.description ?? '',
    prep: r.prep_minutes,
    cook: r.cook_minutes,
    difficulty: r.difficulty ?? 'easy',
    servings: r.servings,
    cover: r.cover_path ? urls.get(r.cover_path) ?? null : null,
    ingredients: (((r.ingredients as { text: string; sort_order: number }[]) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order).map((i) => i.text)),
    steps,
    audio,
    photos,
  };
}

export interface GuideCard { id: string; title: string; description: string; kind: string; steps: number }

export async function getGuides(familyId: string, kind: string): Promise<GuideCard[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('support_guides')
    .select('id, title, description, kind, steps:support_steps(count)')
    .eq('family_id', familyId)
    .eq('kind', kind)
    .order('created_at', { ascending: true });
  return (data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description ?? '',
    kind: g.kind,
    steps: one<{ count: number }>(g.steps)?.count ?? 0,
  }));
}

export interface GuideDetail {
  id: string; title: string; description: string; warnings: string; kind: string;
  steps: { no: number; body: string }[];
}
export async function getGuide(id: string): Promise<GuideDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: g } = await supabase
    .from('support_guides')
    .select('id, title, description, warnings, kind, steps:support_steps(step_no, body)')
    .eq('id', id)
    .maybeSingle();
  if (!g) return null;
  return {
    id: g.id,
    title: g.title,
    description: g.description ?? '',
    warnings: g.warnings ?? '',
    kind: g.kind,
    steps: (((g.steps as { step_no: number; body: string }[]) ?? [])
      .sort((a, b) => a.step_no - b.step_no).map((s) => ({ no: s.step_no, body: s.body }))),
  };
}

/** Counts for the Support home tiles. */
export async function getSupportCounts(familyId: string): Promise<{ recipes: number; laundry: number; home: number }> {
  const supabase = await createClient();
  if (!supabase) return { recipes: 0, laundry: 0, home: 0 };
  const [rec, laun, home] = await Promise.all([
    supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('family_id', familyId),
    supabase.from('support_guides').select('*', { count: 'exact', head: true }).eq('family_id', familyId).eq('kind', 'laundry'),
    supabase.from('support_guides').select('*', { count: 'exact', head: true }).eq('family_id', familyId).eq('kind', 'home_basic'),
  ]);
  return { recipes: rec.count ?? 0, laundry: laun.count ?? 0, home: home.count ?? 0 };
}
