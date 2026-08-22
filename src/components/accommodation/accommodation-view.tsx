'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, Plus, Wifi, Wrench, Zap, FileText, ImagePlus, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ReminderButton } from '@/components/ui/reminder-button';
import { ShareButton } from '@/components/ui/share-button';
import { AccommodationFormDialog } from './accommodation-form-dialog';
import { uploadMedia } from '@/lib/storage';
import { deleteAccommodation, addAccommodationPhoto, deleteAccommodationPhoto } from '@/lib/actions/journey';
import type { AccommodationView as AccView } from '@/lib/journey-queries';

export function AccommodationView({
  list, students, live, canManage, meId, familyId,
}: {
  list: AccView[];
  students: { id: string; name: string }[];
  live: boolean;
  canManage: boolean;
  meId: string;
  familyId: string;
}) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Accommodation</h1>
        {canManage && (
          <AccommodationFormDialog live={live} students={students} familyId={familyId}
            trigger={<Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>} />
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Building2 className="size-6" />} title="No accommodation yet" hint="Add housing details and history." />
      ) : (
        list.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              {canManage ? (
                <AccommodationFormDialog live={live} students={students} familyId={familyId} item={a}
                  trigger={<button type="button" aria-label={`Edit ${a.property}`} className="min-w-0 text-left font-bold text-navy hover:text-brand">{a.property}</button>} />
              ) : (
                <p className="font-bold text-navy">{a.property}</p>
              )}
              <div className="flex items-center gap-1">
                {a.current ? <Chip tone="success">Current</Chip> : <Chip tone="neutral">Past</Chip>}
                <ShareButton text={`🏠 ${a.property}${a.address ? `\n${a.address}` : ''}\n💷 ${a.rent}${a.student ? ` · ${a.student}` : ''}\n${a.start} → ${a.end}`} url="/accommodation" />
                <ReminderButton entityType="accommodation" entityId={a.id} title={a.property} link="/accommodation" live={live} meId={meId} />
                {canManage && (
                  <DeleteButton itemLabel={`“${a.property}”`} title="Delete accommodation"
                    onConfirm={() => (live ? deleteAccommodation(a.id) : Promise.resolve())} onDeleted={() => router.refresh()} />
                )}
              </div>
            </div>
            {a.address && <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" /> {a.address}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {a.student && <Chip tone="navy">{a.student}</Chip>}
              <Chip tone="brand">{a.rent}</Chip>
              {a.deposit != null && <Chip tone="neutral">Deposit {a.currency} {a.deposit}</Chip>}
              <span className="text-xs text-muted-foreground">{a.start} → {a.end}</span>
            </div>
            {a.landlord && <p className="mt-1 text-xs text-muted-foreground">Landlord: {a.landlord}{a.contact ? ` · ${a.contact}` : ''}</p>}

            {(a.wifiInfo || a.utilityNotes || a.maintenanceNotes || a.contractUrl) && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                {a.wifiInfo && <InfoLine icon={<Wifi className="size-4" />} label="Wi-Fi" value={a.wifiInfo} />}
                {a.utilityNotes && <InfoLine icon={<Zap className="size-4" />} label="Utilities" value={a.utilityNotes} />}
                {a.maintenanceNotes && <InfoLine icon={<Wrench className="size-4" />} label="Maintenance" value={a.maintenanceNotes} />}
                {a.contractUrl && (
                  <a href={a.contractUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                    <FileText className="size-4" /> View tenancy contract
                  </a>
                )}
              </div>
            )}

            <AccPhotos acc={a} live={live} canManage={canManage} familyId={familyId} onChange={() => router.refresh()} />
          </Card>
        ))
      )}
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <p className="flex items-start gap-2 text-navy">
      <span className="mt-0.5 text-navy-400">{icon}</span>
      <span><span className="font-semibold">{label}:</span> {value}</span>
    </p>
  );
}

function AccPhotos({ acc, live, canManage, familyId, onChange }: { acc: AccView; live: boolean; canManage: boolean; familyId: string; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const photos = acc.photos.filter((p) => p.url);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !live) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_');
        const path = await uploadMedia(familyId, file, `accommodation/${acc.id}/${Date.now()}-${safe}`);
        if (path) await addAccommodationPhoto(acc.id, path);
      }
      onChange();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (photos.length === 0 && !canManage) return null;
  return (
    <div className="mt-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url!} alt="Accommodation" className="size-full object-cover" />
              {canManage && (
                <DeleteButton itemLabel="this photo" title="Delete photo" className="absolute right-1 top-1 bg-white/85 text-danger backdrop-blur"
                  onConfirm={() => (live ? deleteAccommodationPhoto(p.id) : Promise.resolve())} onDeleted={onChange} />
              )}
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} Add photos
          </button>
        </>
      )}
    </div>
  );
}
