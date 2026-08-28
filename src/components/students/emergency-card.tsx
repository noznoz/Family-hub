'use client';

import { useState } from 'react';
import { Phone, MapPin, HeartPulse, ShieldAlert, User, Fingerprint, Copy, Check, GraduationCap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ShareButton } from '@/components/ui/share-button';

export interface EmergencyInfo {
  name: string;
  university: string | null;
  course: string | null;
  phone: string | null;
  address: string | null;
  emergencyContact: string | null;
  bloodType: string | null;
  gp: string | null;
  passportNumber: string | null;
}

export function EmergencyCard({ info }: { info: EmergencyInfo }) {
  const [copied, setCopied] = useState(false);

  const lines = [
    `🆘 EMERGENCY CARD — ${info.name}`,
    info.university ? `🎓 ${info.university}${info.course ? ` · ${info.course}` : ''}` : '',
    info.phone ? `📞 Phone: ${info.phone}` : '',
    info.address ? `🏠 Address: ${info.address}` : '',
    info.emergencyContact ? `👤 Emergency contact: ${info.emergencyContact}` : '',
    info.bloodType ? `🩸 Blood type: ${info.bloodType}` : '',
    info.gp ? `🏥 GP: ${info.gp}` : '',
    info.passportNumber ? `🛂 Passport: ${info.passportNumber}` : '',
    '',
    'UK emergency: 999 · NHS non-emergency: 111',
  ].filter(Boolean);
  const text = lines.join('\n');

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-danger px-4 py-3 text-white">
        <p className="flex items-center gap-2 font-bold"><ShieldAlert className="size-5" /> Emergency card</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={copy} aria-label="Copy" className="rounded-lg p-1.5 hover:bg-white/15">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
          <span className="[&_button]:!text-white [&_button:hover]:!bg-white/15">
            <ShareButton text={text} />
          </span>
        </div>
      </div>
      <div className="divide-y divide-border">
        <Line icon={<User className="size-4" />} label="Name" value={info.name} />
        {info.university && <Line icon={<GraduationCap className="size-4" />} label="University" value={`${info.university}${info.course ? ` · ${info.course}` : ''}`} />}
        {info.phone && <Line icon={<Phone className="size-4" />} label="Phone" value={info.phone} href={`tel:${info.phone}`} />}
        {info.address && <Line icon={<MapPin className="size-4" />} label="Address" value={info.address} />}
        {info.emergencyContact && <Line icon={<User className="size-4" />} label="Emergency" value={info.emergencyContact} />}
        {info.bloodType && <Line icon={<HeartPulse className="size-4" />} label="Blood type" value={info.bloodType} />}
        {info.gp && <Line icon={<HeartPulse className="size-4" />} label="GP" value={info.gp} />}
        {info.passportNumber && <Line icon={<Fingerprint className="size-4" />} label="Passport" value={info.passportNumber} />}
        <div className="flex items-center gap-2 bg-muted/50 p-3 text-xs font-semibold text-navy">
          <ShieldAlert className="size-4 text-danger" /> UK emergency: 999 · NHS non-emergency: 111
        </div>
      </div>
    </Card>
  );
}

function Line({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="text-navy-400">{icon}</span>
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words text-sm font-medium text-navy">{value}</span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-3 p-3 hover:bg-muted">{body}</a>
  ) : (
    <div className="flex items-center gap-3 p-3">{body}</div>
  );
}
