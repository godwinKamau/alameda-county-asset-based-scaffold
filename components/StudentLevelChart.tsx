import {
  getCaEldLevelLabel,
  getElpacPerformanceLevelLabel,
} from "@/lib/elpac/labels";
import { DOMAIN_LABELS } from "@/lib/elpac/domains";
import { ELPAC_DOMAINS, type ElpacDomain } from "@/lib/types";

export type { ElpacDomain };

export interface DomainLevel {
  domain: ElpacDomain;
  level: number | null;
  sessionCount: number;
}

export type ElpacComposite = "oral" | "written";

export interface CompositeLevel {
  composite: ElpacComposite;
  level: number | null;
  sessionCount: number;
}

const COMPOSITE_LABELS: Record<ElpacComposite, string> = {
  oral: "Oral language",
  written: "Written language",
};

const ORAL_DOMAINS: readonly ElpacDomain[] = ["listening", "speaking"];
const WRITTEN_DOMAINS: readonly ElpacDomain[] = ["reading", "writing"];

interface StudentLevelChartProps {
  domainLevels: DomainLevel[];
}

function normalizeDomain(domain: string): ElpacDomain | null {
  const normalized = domain.trim().toLowerCase();
  if (ELPAC_DOMAINS.includes(normalized as ElpacDomain)) {
    return normalized as ElpacDomain;
  }
  return null;
}

function averageLevels(levels: number[]): { level: number; sessionCount: number } | null {
  if (levels.length === 0) return null;
  const avg = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  return {
    level: Math.round(avg * 10) / 10,
    sessionCount: levels.length,
  };
}

export function computeDomainLevels(
  sessions: { domain: string; estimated_level: number }[],
): DomainLevel[] {
  const buckets = new Map<ElpacDomain, number[]>();

  for (const session of sessions) {
    const d = normalizeDomain(session.domain);
    if (!d) continue;
    const levels = buckets.get(d) ?? [];
    levels.push(session.estimated_level);
    buckets.set(d, levels);
  }

  return ELPAC_DOMAINS.map((d) => {
    const levels = buckets.get(d);
    if (!levels || levels.length === 0) {
      return { domain: d, level: null, sessionCount: 0 };
    }
    const avg =
      levels.reduce((sum, level) => sum + level, 0) / levels.length;
    return {
      domain: d,
      level: Math.round(avg * 10) / 10,
      sessionCount: levels.length,
    };
  });
}

export function computeCompositeLevels(
  sessions: { domain: string; estimated_level: number }[],
): CompositeLevel[] {
  const oralLevels: number[] = [];
  const writtenLevels: number[] = [];

  for (const session of sessions) {
    const d = normalizeDomain(session.domain);
    if (!d) continue;
    if (ORAL_DOMAINS.includes(d)) {
      oralLevels.push(session.estimated_level);
    } else if (WRITTEN_DOMAINS.includes(d)) {
      writtenLevels.push(session.estimated_level);
    }
  }

  const oralAvg = averageLevels(oralLevels);
  const writtenAvg = averageLevels(writtenLevels);

  return [
    {
      composite: "oral",
      level: oralAvg?.level ?? null,
      sessionCount: oralAvg?.sessionCount ?? 0,
    },
    {
      composite: "written",
      level: writtenAvg?.level ?? null,
      sessionCount: writtenAvg?.sessionCount ?? 0,
    },
  ];
}

export function StudentLevelChart({ domainLevels }: StudentLevelChartProps) {
  const maxScale = 4;

  return (
    <div className="ui-card p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Estimated levels by domain
      </h3>
      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {domainLevels.map(({ domain, level, sessionCount }) => {
          const label = DOMAIN_LABELS[domain];
          const hasData = level != null;
          const barHeight = hasData ? (level / maxScale) * 100 : 0;
          const roundedLevel = hasData ? Math.round(level) : null;

          return (
            <div key={domain} className="flex flex-col items-center">
              <div
                className="relative flex h-32 w-full items-end justify-center rounded-lg bg-brand-soft/40 px-2"
                role="img"
                aria-label={
                  hasData
                    ? `${label}: average level ${level} from ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`
                    : `${label}: no data yet`
                }
              >
                {hasData ? (
                  <div
                    className="w-full max-w-[3rem] rounded-t-md bg-brand transition-all"
                    style={{ height: `${barHeight}%`, minHeight: "0.5rem" }}
                  />
                ) : (
                  <div className="mb-2 text-xs text-muted">No data yet</div>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-brand-dark">{label}</p>
              {hasData ? (
                <>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-brand-dark">
                    {level}
                  </p>
                  <p className="mt-0.5 text-center text-xs text-muted">
                    {getCaEldLevelLabel(roundedLevel!)}
                  </p>
                  <p className="text-center text-xs text-muted">
                    {getElpacPerformanceLevelLabel(roundedLevel!)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted">—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CompositeLevelCardProps {
  composite: CompositeLevel;
}

export function CompositeLevelCard({ composite }: CompositeLevelCardProps) {
  const label = COMPOSITE_LABELS[composite.composite];
  const hasData = composite.level != null;
  const level = composite.level;
  const roundedLevel = hasData && level != null ? Math.round(level) : null;

  return (
    <div className="ui-card p-6">
      <p className="text-sm font-medium text-muted">{label}</p>
      {hasData ? (
        <div className="mt-3 flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-soft ring-1 ring-brand-soft"
          >
            <span className="text-3xl font-bold tabular-nums text-brand-dark">
              {composite.level}
            </span>
          </div>
          <div className="min-w-0 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              ELPAC Level {roundedLevel}
            </p>
            <p className="mt-1 text-2xl font-semibold leading-tight text-brand-dark">
              {getCaEldLevelLabel(roundedLevel!)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {getElpacPerformanceLevelLabel(roundedLevel!)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Based on {composite.sessionCount}{" "}
              {composite.sessionCount === 1 ? "analysis" : "analyses"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No data yet</p>
      )}
    </div>
  );
}
