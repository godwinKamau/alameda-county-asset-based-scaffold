"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildAnalyzeUrl } from "@/lib/analyze/url";
import { ELPAC_DOMAINS, domainLabel, type ElpacDomain } from "@/lib/elpac/domain";
import type { LatestAnalysisSummary } from "@/lib/roster/export";
import { formatExactGradeLabel } from "@/lib/roster/display";
import { resolveDisplayName } from "@/lib/roster/group";
import type { ExactGrade, GradeSpan } from "@/lib/types";
import {
  btnDashboardActionClassName,
  btnRowActionClassName,
  btnSecondaryClassName,
  inputClassName,
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
  domain_levels: Record<ElpacDomain, number | null>;
  latest_analysis: LatestAnalysisSummary | null;
  owner_teacher_id?: string;
  access_source?: string;
}

interface GroupData {
  id: string;
  name: string;
  position: number;
  members: { student_uuid: string; position: number }[];
}

type OrganizeBy = "groups" | "avg_level" | "flat";

interface StudentsExplorerProps {
  entries: StudentExplorerEntry[];
  groups: GroupData[];
  readOnly?: boolean;
  showOwner?: boolean;
  onFilteredEntriesChange?: (entries: StudentExplorerEntry[]) => void;
}

function groupEntriesByTeacherGroups(
  entries: StudentExplorerEntry[],
  groups: GroupData[],
): { label: string; entries: StudentExplorerEntry[] }[] {
  const entryByUuid = new Map(
    entries.map((entry) => [entry.student_uuid, entry]),
  );
  const assigned = new Set<string>();
  const sections: { label: string; entries: StudentExplorerEntry[] }[] = [];

  const sortedGroups = [...groups].sort((a, b) => a.position - b.position);

  for (const group of sortedGroups) {
    const members = group.members
      .map((member) => entryByUuid.get(member.student_uuid))
      .filter((entry): entry is StudentExplorerEntry => !!entry);
    if (members.length === 0) continue;
    members.forEach((entry) => assigned.add(entry.student_uuid));
    sections.push({ label: group.name, entries: members });
  }

  const ungrouped = entries
    .filter((entry) => !assigned.has(entry.student_uuid))
    .sort((a, b) =>
      resolveDisplayName(a).localeCompare(resolveDisplayName(b)),
    );

  if (ungrouped.length > 0) {
    sections.push({ label: "Ungrouped", entries: ungrouped });
  }

  return sections;
}

function groupEntriesByAvgLevel(
  entries: StudentExplorerEntry[],
): { label: string; entries: StudentExplorerEntry[] }[] {
  const withData = entries
    .filter((entry) => entry.avg_level != null)
    .sort((a, b) => (b.avg_level ?? 0) - (a.avg_level ?? 0));

  const withoutData = entries
    .filter((entry) => entry.avg_level == null)
    .sort((a, b) =>
      resolveDisplayName(a).localeCompare(resolveDisplayName(b)),
    );

  const groups: { label: string; entries: StudentExplorerEntry[] }[] = [];

  if (withData.length > 0) {
    groups.push({ label: "By average level", entries: withData });
  }
  if (withoutData.length > 0) {
    groups.push({ label: "No analysis yet", entries: withoutData });
  }

  return groups;
}

function groupEntriesFlat(
  entries: StudentExplorerEntry[],
): { label: string; entries: StudentExplorerEntry[] }[] {
  const sorted = [...entries].sort((a, b) =>
    resolveDisplayName(a).localeCompare(resolveDisplayName(b)),
  );

  return [{ label: "All students", entries: sorted }];
}

function formatGrade(entry: StudentExplorerEntry): string {
  if (entry.exact_grade) {
    return formatExactGradeLabel(entry.exact_grade);
  }
  return "Grade not set";
}

function DomainScoreTable({
  domainLevels,
}: {
  domainLevels: Record<ElpacDomain, number | null>;
}) {
  return (
    <div className="min-w-0 flex-1 overflow-x-auto">
      <table className="w-full table-fixed text-left text-xs">
        <thead>
          <tr className="text-muted">
            {ELPAC_DOMAINS.map((domain) => (
              <th
                key={domain}
                className="px-3 py-2 font-medium capitalize sm:px-4"
              >
                {domainLabel(domain)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="text-brand-dark">
            {ELPAC_DOMAINS.map((domain) => {
              const level = domainLevels[domain];
              return (
                <td
                  key={domain}
                  className="border-t border-brand-soft/60 px-3 py-3 align-top sm:px-4"
                >
                  {level != null ? (
                    <span className="text-base font-semibold tabular-nums">
                      {Math.round(level * 10) / 10}
                    </span>
                  ) : (
                    <span className="text-base text-muted">—</span>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface StudentRowProps {
  entry: StudentExplorerEntry;
  displayName: string;
  readOnly?: boolean;
  showOwner?: boolean;
}

function StudentRow({
  entry,
  displayName,
  readOnly = false,
  showOwner = false,
}: StudentRowProps) {
  return (
    <li className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-[minmax(9rem,11rem)_1fr] sm:items-start">
      <div className="flex shrink-0 flex-col gap-2">
        <Link
          href={`/student/${entry.student_uuid}`}
          className="text-lg font-medium leading-tight text-brand-dark hover:text-brand"
        >
          {displayName}
        </Link>
        <p className="text-muted">
          {formatGrade(entry)}
          {entry.known_elpac_level != null &&
            ` · Known level: ${entry.known_elpac_level}`}
        </p>
        <p className="text-xs text-muted">
          {entry.session_count === 0
            ? "No analyses yet"
            : `${entry.session_count} ${entry.session_count === 1 ? "analysis" : "analyses"}`}
          {showOwner && entry.owner_teacher_id
            ? ` · Shared by teacher ${entry.owner_teacher_id.slice(0, 8)}…`
            : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Link
            href={`/student/${entry.student_uuid}`}
            className={`${btnSecondaryClassName} ${btnRowActionClassName}`}
          >
            View history
          </Link>
          {!readOnly && (
            <Link
              href={buildAnalyzeUrl(entry)}
              className={`${btnDashboardActionClassName} ${btnRowActionClassName}`}
            >
              Analyze
            </Link>
          )}
        </div>
      </div>
      <DomainScoreTable domainLevels={entry.domain_levels} />
    </li>
  );
}

export function StudentsExplorer({
  entries,
  groups,
  readOnly = false,
  showOwner = false,
  onFilteredEntriesChange,
}: StudentsExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [organizeBy, setOrganizeBy] = useState<OrganizeBy>("groups");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      if (query) {
        const name = resolveDisplayName(entry).toLowerCase();
        if (!name.includes(query)) return false;
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
  }, [entries, searchQuery, minLevel, maxLevel]);

  const groupedEntries = useMemo(() => {
    switch (organizeBy) {
      case "avg_level":
        return groupEntriesByAvgLevel(filteredEntries);
      case "flat":
        return groupEntriesFlat(filteredEntries);
      case "groups":
      default:
        return groupEntriesByTeacherGroups(filteredEntries, groups);
    }
  }, [filteredEntries, groups, organizeBy]);

  const filteredKey = useMemo(
    () => filteredEntries.map((entry) => entry.student_uuid).join("\0"),
    [filteredEntries],
  );

  const filteredEntriesRef = useRef(filteredEntries);
  filteredEntriesRef.current = filteredEntries;

  useEffect(() => {
    onFilteredEntriesChange?.(filteredEntriesRef.current);
  }, [filteredKey, onFilteredEntriesChange]);

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
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label htmlFor="student-search" className="shrink-0 text-sm font-bold">
            Search:
          </label>
          <input
            id="student-search"
            type="search"
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={`${inputClassName} flex-1`}
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="flex items-center gap-1.5 text-sm text-brand hover:underline"
          >
            <span>{showAdvancedFilters ? "Hide" : "Advanced"} filters</span>
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${showAdvancedFilters ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAdvancedFilters && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  onChange={(event) =>
                    setOrganizeBy(event.target.value as OrganizeBy)
                  }
                  className={selectClassName}
                >
                  <option value="groups">My groups</option>
                  <option value="avg_level">By average level</option>
                  <option value="flat">Flat list (A–Z)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-muted">
        Showing {filteredEntries.length} of {entries.length} students
      </p>

      {filteredEntries.length === 0 ? (
        <p className="text-sm text-muted">
          No students match the current filters.
        </p>
      ) : groupedEntries.length === 0 ? (
        <p className="text-sm text-muted">
          No groups yet. Switch to Organize to create groups and sort students.
        </p>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map((group) => {
            const isCollapsed = collapsedGroups.has(group.label);
            const listId = `students-group-${group.label.replace(/\s+/g, "-").toLowerCase()}`;

            return (
              <section key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={!isCollapsed}
                  aria-controls={listId}
                  className="flex w-full items-center gap-2 text-left text-lg font-semibold text-brand-dark hover:text-brand"
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
                    {group.label}{" "}
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
                        displayName={resolveDisplayName(entry)}
                        readOnly={readOnly}
                        showOwner={showOwner}
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
