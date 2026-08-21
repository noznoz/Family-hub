import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, ChevronRight } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getSearchResults } from '@/lib/search-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSessionUser();
  if (!session) return null;
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const results = query.length >= 2 && !session.isDemo ? await getSearchResults(session.familyId, query) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Search</h1>

      <form action="/search" className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-navy-300" />
        <input
          name="q" defaultValue={query} autoFocus placeholder="Search tasks, money, documents, recipes…"
          className="h-12 w-full rounded-full border border-input bg-white pl-11 pr-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {query.length < 2 ? (
        <EmptyState icon={<Search className="size-6" />} title="Search everything" hint="Find tasks, expenses, documents, trips, recipes and more." />
      ) : results.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title={`No results for “${query}”`} hint="Try a different word." />
      ) : (
        <Card className="divide-y divide-border">
          {results.map((r, i) => (
            <Link key={i} href={r.href} className="flex items-center gap-3 p-4 hover:bg-muted">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy">{r.title}</p>
                {r.subtitle && <p className="truncate text-xs capitalize text-muted-foreground">{r.subtitle}</p>}
              </div>
              <Chip tone="neutral">{r.type}</Chip>
              <ChevronRight className="size-5 text-navy-200" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
