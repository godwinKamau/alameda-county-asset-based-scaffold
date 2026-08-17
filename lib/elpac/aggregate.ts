import type { ElpacDomain } from "./domain";
import {
  evidenceValidity,
  type EvidenceKind,
} from "./evidence";

export interface DomainAggregateRow {
  domain: string;
  evidence_kind: EvidenceKind;
  level_sum: number;
  session_count: number;
}

export interface DomainLevelAggregate {
  domain: ElpacDomain;
  level: number | null;
  primaryCount: number;
  supportingCount: number;
  excludedCount: number;
}

function normalizeDomain(domain: string): ElpacDomain | null {
  const normalized = domain.trim().toLowerCase();
  const domains: ElpacDomain[] = [
    "listening",
    "speaking",
    "reading",
    "writing",
  ];
  if (domains.includes(normalized as ElpacDomain)) {
    return normalized as ElpacDomain;
  }
  return null;
}

export function computeDomainLevelsFromAggregates(
  rows: DomainAggregateRow[],
): DomainLevelAggregate[] {
  const domains: ElpacDomain[] = [
    "listening",
    "speaking",
    "reading",
    "writing",
  ];

  const byDomain = new Map<
    ElpacDomain,
    { primarySum: number; primaryCount: number; supporting: number; excluded: number }
  >();

  for (const domain of domains) {
    byDomain.set(domain, {
      primarySum: 0,
      primaryCount: 0,
      supporting: 0,
      excluded: 0,
    });
  }

  for (const row of rows) {
    const domain = normalizeDomain(row.domain);
    if (!domain) continue;

    const bucket = byDomain.get(domain)!;
    const validity = evidenceValidity(domain, row.evidence_kind);

    if (validity === "primary") {
      bucket.primarySum += row.level_sum;
      bucket.primaryCount += row.session_count;
    } else if (validity === "supporting") {
      bucket.supporting += row.session_count;
    } else {
      bucket.excluded += row.session_count;
    }
  }

  return domains.map((domain) => {
    const bucket = byDomain.get(domain)!;
    const level =
      bucket.primaryCount > 0
        ? Math.round((bucket.primarySum / bucket.primaryCount) * 10) / 10
        : null;

    return {
      domain,
      level,
      primaryCount: bucket.primaryCount,
      supportingCount: bucket.supporting,
      excludedCount: bucket.excluded,
    };
  });
}

/** Legacy path: sessions without evidence_kind (treated as written_artifact). */
export function computeDomainLevels(
  sessions: {
    domain: string;
    estimated_level: number;
    evidence_kind?: EvidenceKind;
  }[],
): DomainLevelAggregate[] {
  const rows: DomainAggregateRow[] = [];

  for (const session of sessions) {
    const domain = normalizeDomain(session.domain);
    if (!domain) continue;

    rows.push({
      domain,
      evidence_kind: session.evidence_kind ?? "written_artifact",
      level_sum: session.estimated_level,
      session_count: 1,
    });
  }

  return computeDomainLevelsFromAggregates(rows);
}
