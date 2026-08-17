import { attachTeacherNames } from "@/lib/auth/teacher-names";
import { ELPAC_DOMAINS, domainLabel } from "@/lib/elpac/domain";
import { cardClassName, sectionTitleClassName } from "@/lib/ui/styles";

interface DomainMatrixRow {
  teacher_id: string;
  teacher_name: string;
  levels: Record<string, number | null>;
}

export async function buildDomainMatrixRows(
  rows: {
    teacher_id: string;
    domain: string;
    avg_level: number;
  }[],
): Promise<DomainMatrixRow[]> {
  const teacherIds = [...new Set(rows.map((row) => row.teacher_id))];
  const named = await attachTeacherNames(
    teacherIds.map((id) => ({ id, role: "teacher", email_hash: "" })),
  );
  const namesById = new Map(named.map((t) => [t.id, t.name]));

  const byTeacher = new Map<string, DomainMatrixRow>();
  for (const row of rows) {
    let entry = byTeacher.get(row.teacher_id);
    if (!entry) {
      entry = {
        teacher_id: row.teacher_id,
        teacher_name: namesById.get(row.teacher_id) ?? `Teacher ${row.teacher_id.slice(0, 8)}`,
        levels: Object.fromEntries(ELPAC_DOMAINS.map((d) => [d, null])),
      };
      byTeacher.set(row.teacher_id, entry);
    }
    entry.levels[row.domain] = Math.round(row.avg_level * 10) / 10;
  }

  return [...byTeacher.values()];
}

export function StudentDomainMatrix({ rows }: { rows: DomainMatrixRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className={cardClassName}>
      <h2 className={sectionTitleClassName}>Levels by teacher and domain</h2>
      <p className="mt-2 text-sm text-muted">
        Each cell shows that teacher&apos;s average estimated level for the
        domain across their analyses of this student.
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
                  return (
                    <td key={domain} className="px-4 py-3">
                      {level != null ? (
                        <span className="font-semibold tabular-nums">
                          {level}
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
