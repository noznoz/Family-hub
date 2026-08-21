'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { can } from '@/lib/permissions';

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function guard() {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: 'Not signed in.' };
  if (!can(session.member.role, 'create_support', session.overrides)) return { ok: false as const, error: 'No permission to add support content.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, error: 'Backend unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  return { ok: true as const, session, supabase, userId: user?.id ?? null };
}

export interface RecipeInput {
  name: string;
  description?: string;
  category?: string;
  prep?: number | null;
  cook?: number | null;
  difficulty?: string;
  servings?: number | null;
  ingredients: string[];
  steps: string[];
}

export async function createRecipe(input: RecipeInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: 'Name is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;

  const { data: rec, error } = await g.supabase.from('recipes').insert({
    family_id: g.session.familyId,
    name: input.name.trim(),
    description: input.description || null,
    category: input.category || 'family_favorites',
    prep_minutes: input.prep ?? null,
    cook_minutes: input.cook ?? null,
    difficulty: input.difficulty || 'easy',
    servings: input.servings ?? null,
    created_by: g.userId,
  }).select('id').single();
  if (error || !rec) return { ok: false, error: error?.message ?? 'Failed to create recipe.' };

  const ingredients = input.ingredients.filter((t) => t.trim());
  if (ingredients.length) {
    await g.supabase.from('recipe_ingredients').insert(
      ingredients.map((text, i) => ({ recipe_id: rec.id, sort_order: i, text: text.trim() })),
    );
  }
  const steps = input.steps.filter((t) => t.trim());
  if (steps.length) {
    await g.supabase.from('recipe_steps').insert(
      steps.map((body, i) => ({ recipe_id: rec.id, step_no: i + 1, body: body.trim() })),
    );
  }
  revalidatePath('/support/recipes');
  return { ok: true, id: rec.id };
}

export interface UpdateRecipeInput extends RecipeInput {
  id: string;
}

/** Update a recipe and replace its ingredients/steps. */
export async function updateRecipe(input: UpdateRecipeInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: 'Name is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;

  const { error } = await g.supabase.from('recipes').update({
    name: input.name.trim(),
    description: input.description || null,
    category: input.category || 'family_favorites',
    prep_minutes: input.prep ?? null,
    cook_minutes: input.cook ?? null,
    difficulty: input.difficulty || 'easy',
    servings: input.servings ?? null,
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  // Replace child rows so removals/reorders are reflected.
  await g.supabase.from('recipe_ingredients').delete().eq('recipe_id', input.id);
  const ingredients = input.ingredients.filter((t) => t.trim());
  if (ingredients.length) {
    await g.supabase.from('recipe_ingredients').insert(
      ingredients.map((text, i) => ({ recipe_id: input.id, sort_order: i, text: text.trim() })),
    );
  }
  await g.supabase.from('recipe_steps').delete().eq('recipe_id', input.id);
  const steps = input.steps.filter((t) => t.trim());
  if (steps.length) {
    await g.supabase.from('recipe_steps').insert(
      steps.map((body, i) => ({ recipe_id: input.id, step_no: i + 1, body: body.trim() })),
    );
  }
  revalidatePath('/support/recipes');
  revalidatePath(`/support/recipes/${input.id}`);
  return { ok: true, id: input.id };
}

export async function deleteRecipe(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('recipes').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/support/recipes');
  return { ok: true };
}

export interface GuideInput {
  title: string;
  description?: string;
  kind: string;   // 'laundry' | 'home_basic' | 'emergency' | 'washing_machine'
  warnings?: string;
  steps: string[];
}

export async function createGuide(input: GuideInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { data: guide, error } = await g.supabase.from('support_guides').insert({
    family_id: g.session.familyId,
    kind: input.kind,
    title: input.title.trim(),
    description: input.description || null,
    warnings: input.warnings || null,
    created_by: g.userId,
  }).select('id').single();
  if (error || !guide) return { ok: false, error: error?.message ?? 'Failed to create guide.' };

  const steps = input.steps.filter((t) => t.trim());
  if (steps.length) {
    await g.supabase.from('support_steps').insert(steps.map((body, i) => ({ guide_id: guide.id, step_no: i + 1, body: body.trim() })));
  }
  revalidatePath('/support');
  return { ok: true, id: guide.id };
}

export async function updateGuide(input: GuideInput & { id: string }): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('support_guides').update({
    title: input.title.trim(),
    description: input.description || null,
    kind: input.kind,
    warnings: input.warnings || null,
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  await g.supabase.from('support_steps').delete().eq('guide_id', input.id);
  const steps = input.steps.filter((t) => t.trim());
  if (steps.length) {
    await g.supabase.from('support_steps').insert(steps.map((body, i) => ({ guide_id: input.id, step_no: i + 1, body: body.trim() })));
  }
  revalidatePath('/support');
  revalidatePath(`/support/guides/${input.id}`);
  return { ok: true, id: input.id };
}

export async function deleteGuide(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('support_guides').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/support');
  return { ok: true };
}

/** Record a voice-note row after the audio has been uploaded to storage. */
export async function saveRecipeVoiceNote(recipeId: string, storagePath: string, durationSec: number): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('support_audio').insert({
    scope: 'recipe',
    recipe_id: recipeId,
    storage_path: storagePath,
    duration_sec: durationSec,
    mime_type: 'audio/webm',
    created_by: g.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/support/recipes/${recipeId}`);
  return { ok: true };
}

export async function setRecipeCover(recipeId: string, storagePath: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('recipes').update({ cover_path: storagePath }).eq('id', recipeId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/support/recipes/${recipeId}`);
  return { ok: true };
}

/** Record a recipe photo after the image has been uploaded to storage. */
export async function addRecipePhoto(recipeId: string, storagePath: string, caption?: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { count } = await g.supabase
    .from('recipe_media').select('id', { count: 'exact', head: true }).eq('recipe_id', recipeId);
  const { error } = await g.supabase.from('recipe_media').insert({
    recipe_id: recipeId,
    storage_path: storagePath,
    caption: caption || null,
    sort_order: count ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/support/recipes/${recipeId}`);
  return { ok: true };
}

export async function deleteRecipePhoto(mediaId: string, recipeId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('recipe_media').delete().eq('id', mediaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/support/recipes/${recipeId}`);
  return { ok: true };
}

export async function deleteVoiceNote(audioId: string, recipeId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('support_audio').delete().eq('id', audioId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/support/recipes/${recipeId}`);
  return { ok: true };
}
