import type { Metadata } from 'next';
import { Building2, MapPin } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getAccommodations } from '@/lib/journey-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Accommodation' };

export default async function AccommodationPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const list = session.isDemo ? [] : await getAccommodations(session.familyId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Accommodation</h1>
      {list.length === 0 ? (
        <EmptyState icon={<Building2 className="size-6" />} title="No accommodation yet" hint="Housing details and history will appear here." />
      ) : (
        list.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-navy">{a.property}</p>
              {a.current ? <Chip tone="success">Current</Chip> : <Chip tone="neutral">Past</Chip>}
            </div>
            {a.address && <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" /> {a.address}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.student && <Chip tone="navy">{a.student}</Chip>}
              <Chip tone="brand">{a.rent}</Chip>
              <span className="text-xs text-muted-foreground">{a.start} → {a.end}</span>
            </div>
            {a.landlord && <p className="mt-1 text-xs text-muted-foreground">Landlord: {a.landlord}</p>}
          </Card>
        ))
      )}
    </div>
  );
}
