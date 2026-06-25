export function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded bg-brand-soft/80"
          style={{ width: `${Math.max(55, 100 - index * 12)}%` }}
        />
      ))}
    </div>
  );
}

export function LevelSkeleton() {
  return (
    <div className="flex items-start gap-4" aria-hidden="true">
      <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-brand-soft/80" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <div className="h-3 w-24 animate-pulse rounded bg-brand-soft/80" />
        <div className="h-7 w-40 animate-pulse rounded bg-brand-soft/80" />
        <div className="h-4 w-56 animate-pulse rounded bg-brand-soft/80" />
      </div>
    </div>
  );
}
