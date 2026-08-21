import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Clock, Users, ChefHat, Mic } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getRecipe } from '@/lib/support-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { VoiceRecorder } from '@/components/support/voice-recorder';
import { RecipeHeaderActions } from '@/components/support/recipe-header-actions';

export const metadata: Metadata = { title: 'Recipe' };

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) return null;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  const canEdit = can(session.member.role, 'create_support');

  return (
    <div className="space-y-5">
      <Link href="/support/recipes" className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><ChevronLeft className="size-4" /> Recipes</Link>

      <Card className="overflow-hidden">
        {recipe.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.cover} alt={recipe.name} className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted"><ChefHat className="size-10 text-navy-200" /></div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-navy">{recipe.name}</h1>
            {canEdit && <RecipeHeaderActions recipe={recipe} live={!session.isDemo} />}
          </div>
          {recipe.description && <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone="neutral" className="capitalize">{recipe.category.replace(/_/g, ' ')}</Chip>
            <Chip tone="neutral" className="capitalize">{recipe.difficulty}</Chip>
            {recipe.prep != null && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" /> Prep {recipe.prep}m</span>}
            {recipe.cook != null && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" /> Cook {recipe.cook}m</span>}
            {recipe.servings != null && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3.5" /> Serves {recipe.servings}</span>}
          </div>
        </div>
      </Card>

      {/* Voice notes */}
      <section className="space-y-2">
        <p className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Mic className="size-3.5" /> Voice notes</p>
        {recipe.audio.filter((a) => a.url).length > 0 && (
          <Card className="space-y-3 p-4">
            {recipe.audio.filter((a) => a.url).map((a) => (
              <audio key={a.id} controls src={a.url!} className="w-full" />
            ))}
          </Card>
        )}
        {canEdit && <VoiceRecorder recipeId={recipe.id} familyId={session.familyId} />}
      </section>

      {recipe.ingredients.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ingredients</p>
          <Card className="divide-y divide-border">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 p-3 text-sm text-navy">
                <span className="size-1.5 shrink-0 rounded-full bg-brand" /> {ing}
              </div>
            ))}
          </Card>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Method</p>
          <ol className="space-y-2">
            {recipe.steps.map((s) => (
              <Card key={s.no} className="flex gap-3 p-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{s.no}</span>
                <div className="pt-0.5">
                  <p className="text-navy">{s.body}</p>
                  {s.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image} alt={`Step ${s.no}`} className="mt-2 rounded-xl" />
                  )}
                </div>
              </Card>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
