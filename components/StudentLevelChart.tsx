import {
  computeDomainLevels,
  type DomainLevelAggregate,
} from "@/lib/elpac/aggregate";
import { domainLabel } from "@/lib/elpac/domain";

export type DomainLevel = DomainLevelAggregate;

export { computeDomainLevels };

interface StudentLevelChartProps {
  domainLevels: DomainLevel[];
}

export function StudentLevelChart({ domainLevels }: StudentLevelChartProps) {
  const maxScale = 4;

  return (
    <div className="ui-card p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Estimated levels by domain
      </h3>
      <p className="mt-2 text-xs text-muted">
        Instructional estimate grounded in ELPAC Performance Level Descriptors.
        Not an ELPAC score; not for reclassification or placement.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {domainLevels.map(
          ({
            domain,
            level,
            primaryCount,
            supportingCount,
            excludedCount,
          }) => {
            const label = domainLabel(domain);
            const hasData = level != null;
            const barHeight = hasData ? (level / maxScale) * 100 : 0;
            const showExcludedOnly =
              !hasData && excludedCount > 0 && primaryCount === 0;

            return (
              <div key={domain} className="flex flex-col items-center">
                <div
                  className="relative flex h-32 w-full items-end justify-center rounded-lg bg-brand-soft/40 px-2"
                  role="img"
                  aria-label={
                    showExcludedOnly
                      ? `${label}: ${excludedCount} session(s) excluded — invalid evidence`
                      : hasData
                        ? `${label}: average level ${level} from ${primaryCount} primary ${primaryCount === 1 ? "session" : "sessions"}`
                        : `${label}: no data yet`
                  }
                >
                  {hasData ? (
                    <div
                      className="w-full max-w-[3rem] rounded-t-md bg-brand transition-all"
                      style={{ height: `${barHeight}%`, minHeight: "0.5rem" }}
                    />
                  ) : showExcludedOnly ? (
                    <div className="mb-2 px-1 text-center text-xs text-accent-orange">
                      Invalid evidence
                    </div>
                  ) : (
                    <div className="mb-2 text-xs text-muted">No data yet</div>
                  )}
                </div>
                <p className="mt-3 text-sm font-medium text-brand-dark">
                  {label}
                </p>
                {hasData ? (
                  <>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-brand-dark">
                      {level}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {primaryCount} primary
                      {supportingCount > 0
                        ? ` · ${supportingCount} supporting`
                        : ""}
                    </p>
                  </>
                ) : showExcludedOnly ? (
                  <p className="mt-2 text-xs text-muted">
                    {excludedCount} excluded
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted">—</p>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
