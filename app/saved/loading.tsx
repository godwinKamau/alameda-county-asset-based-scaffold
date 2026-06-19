import { DashboardShell } from "@/components/DashboardShell";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function SavedInsightsLoading() {
  return (
    <DashboardShell title="Saved Insights">
      <div className="mx-auto max-w-3xl space-y-4">
        <SkeletonCard>
          <Skeleton className="mb-2 h-5 w-48" />
          <Skeleton className="mb-4 h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="mb-2 h-5 w-48" />
          <Skeleton className="mb-4 h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </SkeletonCard>
      </div>
    </DashboardShell>
  );
}
