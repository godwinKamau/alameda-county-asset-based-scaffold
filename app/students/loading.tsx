import { DashboardShell } from "@/components/DashboardShell";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function StudentsLoading() {
  return (
    <DashboardShell title="Students">
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-3.5 w-72" />

        <SkeletonCard>
          {/* filter / search bar row */}
          <div className="mb-6 flex flex-wrap gap-3">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>

          {/* group header */}
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-40" />
          </div>

          {/* student rows */}
          <div className="space-y-px rounded-xl border border-brand-soft/60 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex items-center gap-6">
                  <Skeleton className="h-3 w-16 hidden sm:block" />
                  <Skeleton className="h-3 w-20 hidden md:block" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* second group header */}
          <div className="mt-6 mb-3 flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>

          <div className="space-y-px rounded-xl border border-brand-soft/60 overflow-hidden">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex items-center gap-6">
                  <Skeleton className="h-3 w-16 hidden sm:block" />
                  <Skeleton className="h-3 w-20 hidden md:block" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </DashboardShell>
  );
}
