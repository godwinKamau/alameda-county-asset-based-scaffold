import { DashboardShell } from "@/components/DashboardShell";
import { Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <DashboardShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="ui-card relative overflow-hidden p-5"
            >
              <div className="absolute bottom-0 left-0 right-0 h-1 animate-pulse bg-slate-200" />
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <Skeleton className="h-10 w-72 rounded-2xl" />

          <div className="space-y-3">
            <Skeleton className="h-3 w-48" />
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-20 rounded-2xl" />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Skeleton className="h-3 w-36" />
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16 rounded-xl" />
                  <Skeleton className="h-8 w-20 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
