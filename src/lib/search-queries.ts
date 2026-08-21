import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface SearchHit { type: string; title: string; subtitle: string; href: string }

/** Search across the main entities by keyword. */
export async function getSearchResults(familyId: string, q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const like = `%${term}%`;
  const F = (t: string) => supabase.from(t);

  const [tasks, expenses, requests, docs, trips, recipes, guides, events, accom] = await Promise.all([
    F('tasks').select('id, title').eq('family_id', familyId).ilike('title', like).limit(6),
    F('expenses').select('id, description, category').eq('family_id', familyId).ilike('description', like).limit(6),
    F('payment_requests').select('id, reason').eq('family_id', familyId).ilike('reason', like).limit(6),
    F('documents').select('id, name, category').eq('family_id', familyId).ilike('name', like).limit(6),
    F('trips').select('id, title, destination').eq('family_id', familyId).ilike('title', like).limit(6),
    F('recipes').select('id, name').eq('family_id', familyId).ilike('name', like).limit(6),
    F('support_guides').select('id, title').eq('family_id', familyId).ilike('title', like).limit(6),
    F('calendar_events').select('id, title, kind').eq('family_id', familyId).ilike('title', like).limit(6),
    F('accommodations').select('id, property, address').eq('family_id', familyId).ilike('property', like).limit(6),
  ]);

  const hits: SearchHit[] = [];
  for (const t of tasks.data ?? []) hits.push({ type: 'Task', title: t.title, subtitle: '', href: '/tasks' });
  for (const e of expenses.data ?? []) hits.push({ type: 'Expense', title: e.description || e.category, subtitle: e.category, href: '/money' });
  for (const r of requests.data ?? []) hits.push({ type: 'Payment request', title: r.reason, subtitle: '', href: '/money' });
  for (const d of docs.data ?? []) hits.push({ type: 'Document', title: d.name, subtitle: d.category, href: '/documents' });
  for (const t of trips.data ?? []) hits.push({ type: 'Trip', title: t.title, subtitle: t.destination ?? '', href: '/travel' });
  for (const r of recipes.data ?? []) hits.push({ type: 'Recipe', title: r.name, subtitle: '', href: `/support/recipes/${r.id}` });
  for (const g of guides.data ?? []) hits.push({ type: 'Guide', title: g.title, subtitle: '', href: `/support/guides/${g.id}` });
  for (const e of events.data ?? []) hits.push({ type: 'Event', title: e.title, subtitle: e.kind, href: '/calendar' });
  for (const a of accom.data ?? []) hits.push({ type: 'Accommodation', title: a.property, subtitle: a.address ?? '', href: '/accommodation' });
  return hits;
}
