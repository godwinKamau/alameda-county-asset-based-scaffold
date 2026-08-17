"use client";

import Link from "next/link";
import { useMemo } from "react";
import { buildAnalyzeUrl } from "@/lib/analyze/url";
import {
  formatRelativeTime,
  formatStudentGradeLabel,
  getInitials,
  getStudentDisplayName,
  normalizeSubject,
} from "@/lib/roster/display";
import {
  badgeLevelClassName,
  badgeNeverAnalyzedClassName,
  btnDashboardActionClassName,
  btnRowActionClassName,
  btnSecondaryClassName,
} from "@/lib/ui/styles";

export interface DashboardRosterEntry {
  id: string;
  student_uuid: string;
  label: string;
  subject: string;
  grade_span: import("@/lib/types").GradeSpan;
  exact_grade: import("@/lib/types").ExactGrade | null;
  known_elpac_level: number | null;
  session_count: number;
  avg_level: number | null;
  last_session_at: string | null;
}

interface DashboardTabsProps {
  entries: DashboardRosterEntry[];
}

function StudentAvatar({ label }: { label: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-dark">
      {getInitials(label)}
    </div>
  );
}

function WorkStudentCard({
  entry,
  variant,
}: {
  entry: DashboardRosterEntry;
  variant: "attention" | "recent";
}) {
  const displayName = getStudentDisplayName(entry);
  const subjectLine = [
    normalizeSubject(entry.subject),
    formatStudentGradeLabel(entry.grade_span, entry.exact_grade),
  ].join(" · ");

  const borderColor =
    variant === "attention" ? "border-l-accent-orange" : "border-l-accent-green";

  const level =
    entry.avg_level != null
      ? Math.min(4, Math.max(1, Math.round(entry.avg_level)))
      : entry.known_elpac_level;

  return (
    <li
      className={`flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm border-l-4 ${borderColor}`}
    >
      <StudentAvatar label={displayName} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-brand-dark">{displayName}</p>
        <p className="text-sm text-muted">{subjectLine}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {variant === "attention" ? (
            <span className={badgeNeverAnalyzedClassName}>never analyzed</span>
          ) : (
            <>
              {level != null && (
                <span className={badgeLevelClassName(level)}>
                  Level {level}
                </span>
              )}
              {entry.last_session_at && (
                <span className="text-xs text-muted">
                  {formatRelativeTime(entry.last_session_at)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Link
          href={`/student/${entry.student_uuid}`}
          className={`${btnSecondaryClassName} ${btnRowActionClassName}`}
        >
          History
        </Link>
        <Link
          href={buildAnalyzeUrl({
            student_uuid: entry.student_uuid,
            subject: entry.subject,
            grade_span: entry.grade_span,
            known_elpac_level: entry.known_elpac_level,
          })}
          className={`${btnDashboardActionClassName} ${btnRowActionClassName}`}
        >
          Analyze
        </Link>
      </div>
    </li>
  );
}

export function DashboardTabs({ entries }: DashboardTabsProps) {
  const neverAnalyzed = useMemo(
    () => entries.filter((entry) => entry.session_count === 0),
    [entries],
  );

  const recentlyAnalyzed = useMemo(
    () =>
      entries
        .filter((entry) => entry.session_count > 0)
        .sort((a, b) => {
          const aTime = a.last_session_at
            ? new Date(a.last_session_at).getTime()
            : 0;
          const bTime = b.last_session_at
            ? new Date(b.last_session_at).getTime()
            : 0;
          return bTime - aTime;
        }),
    [entries],
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Needs attention — never analyzed
        </h2>
        {neverAnalyzed.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            All accessible students have at least one analysis.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {neverAnalyzed.map((entry) => (
              <WorkStudentCard
                key={entry.id}
                entry={entry}
                variant="attention"
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Recently analyzed
        </h2>
        {recentlyAnalyzed.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No analyses yet. Start with a student who needs attention above.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recentlyAnalyzed.map((entry) => (
              <WorkStudentCard
                key={entry.id}
                entry={entry}
                variant="recent"
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
