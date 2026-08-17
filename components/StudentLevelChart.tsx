export const ELPAC_DOMAINS = [
  "listening",
  "speaking",
  "reading",
  "writing",
] as const;

export type ElpacDomain = (typeof ELPAC_DOMAINS)[number];

const DOMAIN_LABELS: Record<ElpacDomain, string> = {
  listening: "Listening",
  speaking: "Speaking",
  reading: "Reading",
  writing: "Writing",
};

export interface DomainLevel {
  domain: ElpacDomain;
  level: number | null;
  sessionCount: number;
}

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

export function computeDomainLevels(
  sessions: { domain: string; estimated_level: number }[],
): DomainLevel[] {
  const buckets = new Map<ElpacDomain, number[]>();

  for (const session of sessions) {
    const domain = normalizeDomain(session.domain);
    if (!domain) continue;
    const levels = buckets.get(domain) ?? [];
    levels.push(session.estimated_level);
    buckets.set(domain, levels);
  }

  return ELPAC_DOMAINS.map((domain) => {
    const levels = buckets.get(domain);
    if (!levels || levels.length === 0) {
      return { domain, level: null, sessionCount: 0 };
    }
    const avg =
      levels.reduce((sum, level) => sum + level, 0) / levels.length;
    return {
      domain,
      level: Math.round(avg * 10) / 10,
      sessionCount: levels.length,
    };
  });
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
