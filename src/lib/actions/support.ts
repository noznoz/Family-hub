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
  if (!can(session.member.role, 'create_support')) return { ok: false as const, error: 'No permission to add support content.' };
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

export async function deleteVoiceNote(audioId: string, recipeId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('support_audio').delete().eq('id', audioId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/support/recipes/${recipeId}`);
  return { ok: true };
}
