import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ChefHat, ChevronLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getRecipes } from '@/lib/support-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { RecipeCreateDialog } from '@/components/support/recipe-create-dialog';

export const metadata: Metadata = { title: 'Recipes' };

export default async function RecipesPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const recipes = session.isDemo ? [] : await getRecipes(session.familyId);
  const canCreate = can(session.member.role, 'create_support');

  return (
    <div className="space-y-4">
      <Link href="/support" className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><ChevronLeft className="size-4" /> Support</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Recipes</h1>
        {canCreate && <RecipeCreateDialog live={!session.isDemo} />}
      </div>

      {recipes.length === 0 ? (
        <EmptyState icon={<ChefHat className="size-6" />} title="No recipes yet" hint="Add a family recipe with photos and voice notes." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => (
            <Link key={r.id} href={`/support/recipes/${r.id}`}>
              <Card className="overflow-hidden transition-shadow hover:shadow-card-hover">
                {r.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.cover} alt={r.name} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-muted"><ChefHat className="size-8 text-navy-200" /></div>
                )}
                <div className="p-4">
                  <p className="font-bold text-navy">{r.name}</p>
                  {r.description && <p className="line-clamp-1 text-sm text-muted-foreground">{r.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip tone="neutral" className="capitalize">{r.category.replace(/_/g, ' ')}</Chip>
                    {(r.prep || r.cook) != null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" /> {(r.prep ?? 0) + (r.cook ?? 0)} min
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
