import { DashboardShell } from "@/components/DashboardShell";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function ProgressLoading() {
  return (
    <DashboardShell title="Progress">
      <div className="mx-auto max-w-3xl">
        <SkeletonCard>
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="h-3 w-96" />
        </SkeletonCard>
      </div>
    </DashboardShell>
  );
}
