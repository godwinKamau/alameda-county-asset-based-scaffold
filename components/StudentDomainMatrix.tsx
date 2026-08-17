import { attachTeacherNames } from "@/lib/auth/teacher-names";
import {
  computeDomainLevelsFromAggregates,
  type DomainAggregateRow,
} from "@/lib/elpac/aggregate";
import { ELPAC_DOMAINS, domainLabel } from "@/lib/elpac/domain";
import { cardClassName, sectionTitleClassName } from "@/lib/ui/styles";

interface DomainMatrixRow {
  teacher_id: string;
  teacher_name: string;
  levels: Record<string, number | null>;
  excluded: Record<string, number>;
}

export async function buildDomainMatrixRows(
  rows: {
    teacher_id: string;
    domain: string;
    evidence_kind: string;
    level_sum: number;
    session_count: number;
  }[],
): Promise<DomainMatrixRow[]> {
  const teacherIds = [...new Set(rows.map((row) => row.teacher_id))];
  const named = await attachTeacherNames(
    teacherIds.map((id) => ({ id, role: "teacher", email_hash: "" })),
  );
  const namesById = new Map(named.map((t) => [t.id, t.name]));

  const byTeacher = new Map<
    string,
    { aggregateRows: DomainAggregateRow[]; teacher_name: string }
  >();

  for (const row of rows) {
    let entry = byTeacher.get(row.teacher_id);
    if (!entry) {
      entry = {
        teacher_name:
          namesById.get(row.teacher_id) ??
          `Teacher ${row.teacher_id.slice(0, 8)}`,
        aggregateRows: [],
      };
      byTeacher.set(row.teacher_id, entry);
    }
    entry.aggregateRows.push({
      domain: row.domain,
      evidence_kind: row.evidence_kind as DomainAggregateRow["evidence_kind"],
      level_sum: row.level_sum,
      session_count: row.session_count,
    });
  }

  return [...byTeacher.entries()].map(([teacher_id, entry]) => {
    const domainLevels = computeDomainLevelsFromAggregates(entry.aggregateRows);
    const levels = Object.fromEntries(
      ELPAC_DOMAINS.map((d) => [d, null as number | null]),
    );
    const excluded = Object.fromEntries(
      ELPAC_DOMAINS.map((d) => [d, 0]),
    );

    for (const aggregate of domainLevels) {
      levels[aggregate.domain] = aggregate.level;
      excluded[aggregate.domain] = aggregate.excludedCount;
    }

    return {
      teacher_id,
      teacher_name: entry.teacher_name,
      levels,
      excluded,
    };
  });
}

export function StudentDomainMatrix({ rows }: { rows: DomainMatrixRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className={cardClassName}>
      <h2 className={sectionTitleClassName}>Levels by teacher and domain</h2>
      <p className="mt-2 text-sm text-muted">
        Each cell shows that teacher&apos;s average estimated level from primary
        evidence only across their analyses of this student.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-brand-soft/80">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-brand-soft bg-brand-soft/40 text-muted">
              <th className="px-4 py-3 font-medium">Teacher</th>
              {ELPAC_DOMAINS.map((domain) => (
                <th key={domain} className="px-4 py-3 font-medium capitalize">
                  {domainLabel(domain)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.teacher_id}
                className="border-b border-brand-soft/60 text-brand-dark last:border-0"
              >
                <td className="px-4 py-3 font-medium">{row.teacher_name}</td>
                {ELPAC_DOMAINS.map((domain) => {
                  const level = row.levels[domain];
                  const excluded = row.excluded[domain] ?? 0;
                  return (
                    <td key={domain} className="px-4 py-3">
                      {level != null ? (
                        <span className="font-semibold tabular-nums">
                          {level}
                        </span>
                      ) : excluded > 0 ? (
                        <span className="text-xs text-accent-orange">
                          {excluded} excl.
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
