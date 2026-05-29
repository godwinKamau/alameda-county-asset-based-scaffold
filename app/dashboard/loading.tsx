import { DashboardShell } from "@/components/DashboardShell";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <DashboardShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* stat + action row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="ui-card relative max-w-xs flex-1 overflow-hidden p-5">
            <div className="absolute bottom-0 left-0 right-0 h-1 animate-pulse bg-slate-200" />
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-12" />
              </div>
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-xl sm:shrink-0" />
        </div>

        {/* add student form */}
        <SkeletonCard>
          <Skeleton className="mb-1 h-5 w-32" />
          <Skeleton className="mb-6 h-3 w-72" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </SkeletonCard>

        {/* roster */}
        <SkeletonCard>
          <Skeleton className="mb-4 h-5 w-28" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-brand-soft/60 px-4 py-3"
              >
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </DashboardShell>
  );
}
