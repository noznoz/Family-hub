'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createRecipe, updateRecipe } from '@/lib/actions/support';
import type { RecipeDetail } from '@/lib/support-queries';

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snacks', 'quick', 'family_favorites'];

export function RecipeCreateDialog({
  live,
  recipe,
  trigger,
}: {
  live: boolean;
  /** When provided, the dialog edits this recipe instead of creating one. */
  recipe?: RecipeDetail;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = !!recipe;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return setError('Name is required.');
    setError(null);
    const toLines = (k: string) => String(formData.get(k) ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    const num = (k: string) => { const n = Number(formData.get(k)); return Number.isFinite(n) && n > 0 ? n : null; };

    startTransition(async () => {
      const payload = {
        name,
        description: String(formData.get('description') ?? ''),
        category: String(formData.get('category') ?? 'family_favorites'),
        prep: num('prep'), cook: num('cook'),
        difficulty: String(formData.get('difficulty') ?? 'easy'),
        servings: num('servings'),
        ingredients: toLines('ingredients'),
        steps: toLines('steps'),
      };
      const res = isEdit
        ? await updateRecipe({ id: recipe!.id, ...payload })
        : await createRecipe(payload);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      if (!isEdit && res.id) router.push(`/support/recipes/${res.id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>}
      </DialogTrigger>
      <DialogContent title={isEdit ? 'Edit recipe' : 'New recipe'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Name" htmlFor="name"><Input id="name" name="name" required defaultValue={recipe?.name} placeholder="e.g. Chicken & Rice" /></Field>
          <Field label="Description" htmlFor="description"><Input id="description" name="description" defaultValue={recipe?.description} placeholder="Optional" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="category">
              <Select id="category" name="category" defaultValue={recipe?.category ?? 'family_favorites'} className="capitalize">
                {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c.replace(/_/g, ' ')}</option>)}
              </Select>
            </Field>
            <Field label="Difficulty" htmlFor="difficulty">
              <Select id="difficulty" name="difficulty" defaultValue={recipe?.difficulty ?? 'easy'}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Prep (min)" htmlFor="prep"><Input id="prep" name="prep" type="number" min="0" inputMode="numeric" defaultValue={recipe?.prep ?? undefined} /></Field>
            <Field label="Cook (min)" htmlFor="cook"><Input id="cook" name="cook" type="number" min="0" inputMode="numeric" defaultValue={recipe?.cook ?? undefined} /></Field>
            <Field label="Serves" htmlFor="servings"><Input id="servings" name="servings" type="number" min="0" inputMode="numeric" defaultValue={recipe?.servings ?? undefined} /></Field>
          </div>
          <Field label="Ingredients (one per line)" htmlFor="ingredients">
            <textarea id="ingredients" name="ingredients" rows={4} defaultValue={recipe?.ingredients.join('\n')} placeholder={'2 chicken breasts\n1 cup rice'} className="flex w-full rounded-xl border border-input bg-white px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </Field>
          <Field label="Steps (one per line)" htmlFor="steps">
            <textarea id="steps" name="steps" rows={4} defaultValue={recipe?.steps.map((s) => s.body).join('\n')} placeholder={'Fry the onion\nAdd chicken'} className="flex w-full rounded-xl border border-input bg-white px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </Field>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create recipe'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
