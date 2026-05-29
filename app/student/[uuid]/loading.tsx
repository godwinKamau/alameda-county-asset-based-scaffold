import { DashboardShell } from "@/components/DashboardShell";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function StudentLoading() {
  return (
    <DashboardShell title="Student History">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* name + action */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>

        {/* average level card */}
        <SkeletonCard>
          <Skeleton className="mb-3 h-3 w-36" />
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </SkeletonCard>

        {/* chart */}
        <SkeletonCard>
          <Skeleton className="h-32 w-full rounded-lg" />
        </SkeletonCard>

        {/* session entries */}
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="bg-brand-soft/20">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-4">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>
    </DashboardShell>
  );
}
