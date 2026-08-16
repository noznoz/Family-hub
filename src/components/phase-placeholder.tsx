import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';

/**
 * Structured placeholder for modules planned in later build phases.
 * Renders a real header, the planned capabilities, and a clear status —
 * never a blank screen.
 */
export function PhasePlaceholder({
  title,
  phase,
  intro,
  features,
}: {
  title: string;
  phase: string;
  intro: string;
  features: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
        <Chip tone="brand">{phase}</Chip>
      </div>
      <p className="text-sm text-muted-foreground">{intro}</p>
      <Card className="p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Planned in this module
        </p>
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-navy">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              {f}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
