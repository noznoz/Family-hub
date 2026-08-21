'use client';

import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { RecipeCreateDialog } from './recipe-create-dialog';
import { deleteRecipe } from '@/lib/actions/support';
import type { RecipeDetail } from '@/lib/support-queries';

export function RecipeHeaderActions({ recipe, live }: { recipe: RecipeDetail; live: boolean }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-1">
      <RecipeCreateDialog
        live={live}
        recipe={recipe}
        trigger={
          <Button variant="outline" size="sm"><Pencil className="size-4" /> Edit</Button>
        }
      />
      <DeleteButton
        itemLabel={`“${recipe.name}”`}
        title="Delete recipe"
        iconOnly={false}
        onConfirm={() => (live ? deleteRecipe(recipe.id) : Promise.resolve())}
        onDeleted={() => router.push('/support/recipes')}
        className="border border-border"
      />
    </div>
  );
}
