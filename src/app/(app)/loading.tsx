export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-8 w-40 rounded-lg bg-navy-100/70" />
      <div className="h-40 rounded-2xl bg-navy-100/50" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-navy-100/50" />
        <div className="h-24 rounded-2xl bg-navy-100/50" />
      </div>
      <div className="h-32 rounded-2xl bg-navy-100/50" />
    </div>
  );
}
