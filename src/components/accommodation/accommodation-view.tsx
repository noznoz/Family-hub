'use client';

import { useRouter } from 'next/navigation';
import { Building2, MapPin, Plus, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { AccommodationFormDialog } from './accommodation-form-dialog';
import { deleteAccommodation } from '@/lib/actions/journey';
import type { AccommodationView as AccView } from '@/lib/journey-queries';

export function AccommodationView({
  list, students, live, canManage,
}: {
  list: AccView[];
  students: { id: string; name: string }[];
  live: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Accommodation</h1>
        {canManage && (
          <AccommodationFormDialog live={live} students={students}
            trigger={<Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>} />
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Building2 className="size-6" />} title="No accommodation yet" hint="Add housing details and history." />
      ) : (
        list.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-navy">{a.property}</p>
              <div className="flex items-center gap-1">
                {a.current ? <Chip tone="success">Current</Chip> : <Chip tone="neutral">Past</Chip>}
                {canManage && (
                  <>
                    <AccommodationFormDialog live={live} students={students} item={a}
                      trigger={<button type="button" aria-label="Edit accommodation" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-4" /></button>} />
                    <DeleteButton itemLabel={`“${a.property}”`} title="Delete accommodation"
                      onConfirm={() => (live ? deleteAccommodation(a.id) : Promise.resolve())} onDeleted={() => router.refresh()} />
                  </>
                )}
              </div>
            </div>
            {a.address && <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" /> {a.address}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {a.student && <Chip tone="navy">{a.student}</Chip>}
              <Chip tone="brand">{a.rent}</Chip>
              <span className="text-xs text-muted-foreground">{a.start} → {a.end}</span>
            </div>
            {a.landlord && <p className="mt-1 text-xs text-muted-foreground">Landlord: {a.landlord}{a.contact ? ` · ${a.contact}` : ''}</p>}
          </Card>
        ))
      )}
    </div>
  );
}
