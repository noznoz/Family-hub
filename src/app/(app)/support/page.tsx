import type { Metadata } from 'next';
import Link from 'next/link';
import { Utensils, Shirt, Home, Phone, ChevronRight } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getGuides, getSupportCounts } from '@/lib/support-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Support' };

export default async function SupportPage() {
  const session = await getSessionUser();
  if (!session) return null;

  const [counts, laundry, home] = session.isDemo
    ? [{ recipes: 0, laundry: 0, home: 0 }, [], []]
    : await Promise.all([
        getSupportCounts(session.familyId),
        getGuides(session.familyId, 'laundry'),
        getGuides(session.familyId, 'home_basic'),
      ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">The things you&apos;d normally call home to ask.</p>
      </div>

      <Link href="/support/recipes">
        <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-card-hover">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-attention-soft text-attention"><Utensils className="size-6" /></span>
          <div className="flex-1">
            <p className="font-bold text-navy">Food Recipes</p>
            <p className="text-sm text-muted-foreground">{counts.recipes} recipe{counts.recipes === 1 ? '' : 's'} · photos &amp; voice notes</p>
          </div>
          <ChevronRight className="size-5 text-navy-200" />
        </Card>
      </Link>

      <GuideSection icon={<Shirt className="size-5" />} title="Laundry" guides={laundry} />
      <GuideSection icon={<Home className="size-5" />} title="Home Basics" guides={home} />

      <section className="space-y-2">
        <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Emergency &amp; Useful Info</p>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger"><Phone className="size-5" /></span>
          <div className="text-sm">
            <p className="font-semibold text-navy">UK emergency: 999 · Non-emergency: 111</p>
            <p className="text-muted-foreground">Keep passport, visa &amp; insurance details in Documents.</p>
          </div>
        </Card>
      </section>
    </div>
  );
}

function GuideSection({ icon, title, guides }: { icon: React.ReactNode; title: string; guides: Awaited<ReturnType<typeof getGuides>> }) {
  return (
    <section className="space-y-2">
      <p className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{icon} {title}</p>
      {guides.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} guides yet`} />
      ) : (
        <Card className="divide-y divide-border">
          {guides.map((g) => (
            <Link key={g.id} href={`/support/guides/${g.id}`} className="flex items-center gap-3 p-4 hover:bg-muted">
              <div className="flex-1">
                <p className="font-semibold text-navy">{g.title}</p>
                {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
              </div>
              <Chip tone="neutral">{g.steps} steps</Chip>
              <ChevronRight className="size-5 text-navy-200" />
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}
