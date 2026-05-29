"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildAnalyzeUrl } from "@/lib/analyze/url";
import { formatStudentGradeLabel } from "@/lib/roster/display";
import {
  getLabelMapping,
  groupEntriesBySubject,
  resolveDisplayName,
} from "@/lib/roster/group";
import { getCaEldLevelLabel } from "@/lib/elpac/labels";
import type { ExactGrade, GradeSpan } from "@/lib/types";
import {
  inputClassName,
  linkClassName,
  selectClassName,
} from "@/lib/ui/styles";

export interface StudentExplorerEntry {
  id: string;
  student_uuid: string;
  label: string;
  subject: string;
  grade_span: GradeSpan;
  exact_grade: ExactGrade | null;
  known_elpac_level: number | null;
  session_count: number;
  avg_level: number | null;
  last_session_at: string | null;
}

type OrganizeBy = "subject" | "grade_span" | "avg_level" | "flat";

const GRADE_SPANS: GradeSpan[] = ["K", "1-2", "3-12"];
const GRADE_SPAN_LABELS: Record<GradeSpan, string> = {
  K: "Kindergarten (K PLD)",
  "1-2": "Grades 1–2 PLD",
  "3-12": "Grades 3–12 PLD",
};

interface StudentsExplorerProps {
  entries: StudentExplorerEntry[];
  existingSubjects: string[];
}

function formatAvgLevel(avgLevel: number | null): string {
  if (avgLevel == null) return "—";
  const rounded = Math.round(avgLevel * 10) / 10;
  return `${rounded} (${getCaEldLevelLabel(Math.round(avgLevel))})`;
}

function groupEntriesByGradeSpan(
  entries: StudentExplorerEntry[],
): { subject: string; entries: StudentExplorerEntry[] }[] {
  const groups = new Map<GradeSpan, StudentExplorerEntry[]>();

  for (const entry of entries) {
    const existing = groups.get(entry.grade_span) ?? [];
    existing.push(entry);
    groups.set(entry.grade_span, existing);
  }

  return GRADE_SPANS.filter((span) => groups.has(span)).map((span) => ({
    subject: GRADE_SPAN_LABELS[span],
    entries: groups.get(span) ?? [],
  }));
}

function groupEntriesByAvgLevel(
  entries: StudentExplorerEntry[],
  mapping: Record<string, string>,
): { subject: string; entries: StudentExplorerEntry[] }[] {
  const withData = entries
    .filter((entry) => entry.avg_level != null)
    .sort((a, b) => (b.avg_level ?? 0) - (a.avg_level ?? 0));

  const withoutData = entries
    .filter((entry) => entry.avg_level == null)
    .sort((a, b) =>
      resolveDisplayName(a, mapping).localeCompare(resolveDisplayName(b, mapping)),
    );

  const groups: { subject: string; entries: StudentExplorerEntry[] }[] = [];

  if (withData.length > 0) {
    groups.push({ subject: "By average level", entries: withData });
  }
  if (withoutData.length > 0) {
    groups.push({ subject: "No analysis yet", entries: withoutData });
  }

  return groups;
}

function groupEntriesFlat(
  entries: StudentExplorerEntry[],
  mapping: Record<string, string>,
): { subject: string; entries: StudentExplorerEntry[] }[] {
  const sorted = [...entries].sort((a, b) =>
    resolveDisplayName(a, mapping).localeCompare(resolveDisplayName(b, mapping)),
  );

  return [{ subject: "All students", entries: sorted }];
}

interface StudentRowProps {
  entry: StudentExplorerEntry;
  displayName: string;
}

function StudentRow({ entry, displayName }: StudentRowProps) {
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <Link
          href={`/student/${entry.student_uuid}`}
          className="font-medium text-brand-dark hover:text-brand"
        >
          {displayName}
        </Link>
        <p className="text-muted">
          {formatStudentGradeLabel(entry.grade_span, entry.exact_grade)}
          {entry.known_elpac_level != null &&
            ` · Known level: ${entry.known_elpac_level}`}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {entry.session_count === 0
            ? "No analyses yet"
            : `${entry.session_count} ${entry.session_count === 1 ? "analysis" : "analyses"} · Avg level ${formatAvgLevel(entry.avg_level)}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
        <Link href={buildAnalyzeUrl(entry)} className={linkClassName}>
          Analyze
        </Link>
        <Link
          href={`/student/${entry.student_uuid}`}
          className={linkClassName}
        >
          View history
        </Link>
      </div>
    </li>
  );
}

export function StudentsExplorer({
  entries,
  existingSubjects,
}: StudentsExplorerProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeSpanFilter, setGradeSpanFilter] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [organizeBy, setOrganizeBy] = useState<OrganizeBy>("subject");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setMapping(getLabelMapping());
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (query) {
        const name = resolveDisplayName(entry, mapping).toLowerCase();
        if (!name.includes(query)) return false;
      }

      if (subjectFilter && entry.subject.trim() !== subjectFilter) {
        return false;
      }

      if (gradeSpanFilter && entry.grade_span !== gradeSpanFilter) {
        return false;
      }

      if (minLevel && entry.avg_level != null) {
        if (entry.avg_level < Number(minLevel)) return false;
      } else if (minLevel && entry.avg_level == null) {
        return false;
      }

      if (maxLevel && entry.avg_level != null) {
        if (entry.avg_level > Number(maxLevel)) return false;
      } else if (maxLevel && entry.avg_level == null) {
        return false;
      }

      return true;
    });
  }, [
    entries,
    mapping,
    searchQuery,
    subjectFilter,
    gradeSpanFilter,
    minLevel,
    maxLevel,
  ]);

  const groupedEntries = useMemo(() => {
    switch (organizeBy) {
      case "grade_span":
        return groupEntriesByGradeSpan(filteredEntries);
      case "avg_level":
        return groupEntriesByAvgLevel(filteredEntries, mapping);
      case "flat":
        return groupEntriesFlat(filteredEntries, mapping);
      case "subject":
      default:
        return groupEntriesBySubject(filteredEntries);
    }
  }, [filteredEntries, organizeBy, mapping]);

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted">
        No students yet. Add students from the dashboard to get started.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="student-search" className="sr-only">
            Search by name
          </label>
          <input
            id="student-search"
            type="search"
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="subject-filter" className="sr-only">
            Filter by subject
          </label>
          <select
            id="subject-filter"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
            className={selectClassName}
          >
            <option value="">All subjects</option>
            {existingSubjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="grade-span-filter" className="sr-only">
            Filter by grade span
          </label>
          <select
            id="grade-span-filter"
            value={gradeSpanFilter}
            onChange={(event) => setGradeSpanFilter(event.target.value)}
            className={selectClassName}
          >
            <option value="">All grade spans</option>
            {GRADE_SPANS.map((span) => (
              <option key={span} value={span}>
                {GRADE_SPAN_LABELS[span]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="min-level-filter" className="sr-only">
            Minimum average level
          </label>
          <select
            id="min-level-filter"
            value={minLevel}
            onChange={(event) => setMinLevel(event.target.value)}
            className={selectClassName}
          >
            <option value="">Min avg level</option>
            {[1, 2, 3, 4].map((level) => (
              <option key={level} value={level}>
                Level {level}+
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="max-level-filter" className="sr-only">
            Maximum average level
          </label>
          <select
            id="max-level-filter"
            value={maxLevel}
            onChange={(event) => setMaxLevel(event.target.value)}
            className={selectClassName}
          >
            <option value="">Max avg level</option>
            {[1, 2, 3, 4].map((level) => (
              <option key={level} value={level}>
                Level {level} or below
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="organize-by" className="sr-only">
            Organize by
          </label>
          <select
            id="organize-by"
            value={organizeBy}
            onChange={(event) => setOrganizeBy(event.target.value as OrganizeBy)}
            className={selectClassName}
          >
            <option value="subject">Organize by subject</option>
            <option value="grade_span">Organize by grade span</option>
            <option value="avg_level">Organize by average level</option>
            <option value="flat">Flat list (A–Z)</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-muted">
        Showing {filteredEntries.length} of {entries.length} students
      </p>

      {filteredEntries.length === 0 ? (
        <p className="text-sm text-muted">
          No students match the current filters.
        </p>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map((group) => {
            const isCollapsed = collapsedGroups.has(group.subject);
            const listId = `students-group-${group.subject.replace(/\s+/g, "-").toLowerCase()}`;

            return (
              <section key={group.subject}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.subject)}
                  aria-expanded={!isCollapsed}
                  aria-controls={listId}
                  className="flex w-full items-center gap-2 text-left text-sm font-semibold text-brand-dark hover:text-brand"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                      isCollapsed ? "" : "rotate-90"
                    }`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    {group.subject}{" "}
                    <span className="font-normal text-muted">
                      ({group.entries.length})
                    </span>
                  </span>
                </button>
                {!isCollapsed && (
                  <ul
                    id={listId}
                    className="mt-2 divide-y divide-brand-soft/60 rounded-xl border border-brand-soft/80"
                  >
                    {group.entries.map((entry) => (
                      <StudentRow
                        key={entry.id}
                        entry={entry}
                        displayName={resolveDisplayName(entry, mapping)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
