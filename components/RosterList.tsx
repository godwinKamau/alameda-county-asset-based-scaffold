"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatExactGradeLabel } from "@/lib/roster/display";
import {
  groupEntriesByExactGrade,
  resolveDisplayName,
} from "@/lib/roster/group";
import { EXACT_GRADES } from "@/lib/roster/grade";
import { buildAnalyzeUrl } from "@/lib/analyze/url";
import { deriveGradeSpan, type ExactGrade, type GradeSpan } from "@/lib/types";
import {
  btnPrimaryClassName,
  linkClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { apiFetch, isDatabaseWakingError } from "@/lib/ui/api-fetch";
import { NewAnalysisIcon } from "./NewAnalysisIcon";

export interface RosterListEntry {
  id: string;
  student_uuid: string;
  label: string;
  subject: string;
  grade_span: GradeSpan;
  exact_grade: ExactGrade | null;
  known_elpac_level: number | null;
}

interface RosterListProps {
  entries: RosterListEntry[];
  existingSubjects?: string[];
  manageMode?: boolean;
  apiBase?: string;
  onMutated?: () => void;
}

export function RosterList({
  entries,
  manageMode = false,
  apiBase = "/api/roster",
  onMutated,
}: RosterListProps) {
  const router = useRouter();
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  const [editingGradeUuid, setEditingGradeUuid] = useState<string | null>(null);
  const [editExactGrade, setEditExactGrade] = useState("");
  const [savingUuid, setSavingUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [openMenuUuid, setOpenMenuUuid] = useState<string | null>(null);

  const groupedEntries = useMemo(
    () => groupEntriesByExactGrade(entries),
    [entries],
  );

  function startEditingGrade(entry: RosterListEntry) {
    setEditingGradeUuid(entry.student_uuid);
    setEditExactGrade(entry.exact_grade ?? "");
    setError(null);
  }

  function cancelEditingGrade() {
    setEditingGradeUuid(null);
    setEditExactGrade("");
  }

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  async function handleSaveGrade(entry: RosterListEntry) {
    if (!editExactGrade) {
      setError("Please select a grade.");
      return;
    }

    setError(null);
    setSavingUuid(entry.student_uuid);

    try {
      const grade = editExactGrade as ExactGrade;
      const response = await apiFetch(`${apiBase}/${entry.student_uuid}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade_span: deriveGradeSpan(grade),
          exact_grade: grade,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update grade");
      }

      cancelEditingGrade();
      onMutated?.() ?? router.refresh();
    } catch (saveError) {
      if (isDatabaseWakingError(saveError)) return;
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update grade",
      );
    } finally {
      setSavingUuid(null);
    }
  }

  async function handleDelete(entry: RosterListEntry) {
    const displayName = resolveDisplayName(entry);
    const confirmed = window.confirm(
      `Remove ${displayName} from your roster? Their analysis history will also be deleted. This cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setDeletingUuid(entry.student_uuid);

    try {
      const response = await apiFetch(`${apiBase}/${entry.student_uuid}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete student");
      }

      onMutated?.() ?? router.refresh();
    } catch (deleteError) {
      if (isDatabaseWakingError(deleteError)) return;
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete student",
      );
    } finally {
      setDeletingUuid(null);
    }
  }

  function formatGrade(entry: RosterListEntry): string {
    if (entry.exact_grade) {
      return formatExactGradeLabel(entry.exact_grade);
    }
    return "Grade not set";
  }

  if (entries.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted">
        No students yet. Add a student above or upload a CSV to get started.
      </p>
    );
  }

  return (
    <>
      {error && (
        <p className="mt-4 text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 space-y-6">
        {groupedEntries.map((group) => {
          const isCollapsed = collapsedGroups.has(group.label);
          const listId = `roster-group-${group.label.replace(/\s+/g, "-").toLowerCase()}`;

          return (
            <section key={group.label}>
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
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
                  {group.entries.map((entry) => {
                    const isEditingGrade =
                      editingGradeUuid === entry.student_uuid;
                    const isSaving = savingUuid === entry.student_uuid;

                    return (
                      <li
                        key={entry.id}
                        className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-brand-dark">
                            {resolveDisplayName(entry)}
                          </p>
                          <p className="text-muted">
                            {formatGrade(entry)}
                            {entry.known_elpac_level != null &&
                              ` · Known level: ${entry.known_elpac_level}`}
                          </p>
                          {!manageMode && (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() =>
                                  isEditingGrade
                                    ? cancelEditingGrade()
                                    : startEditingGrade(entry)
                                }
                                aria-expanded={isEditingGrade}
                                className={`text-xs transition-colors ${
                                  isEditingGrade
                                    ? "font-semibold text-brand"
                                    : "text-muted hover:text-brand-dark"
                                }`}
                              >
                                Edit grade
                              </button>
                            </div>
                          )}
                          {isEditingGrade && (
                            <div className="mt-3 space-y-2 rounded-lg border border-brand-soft bg-brand-soft/30 p-3">
                              <label
                                htmlFor={`grade-exact-${entry.student_uuid}`}
                                className="sr-only"
                              >
                                Grade
                              </label>
                              <select
                                id={`grade-exact-${entry.student_uuid}`}
                                value={editExactGrade}
                                onChange={(event) =>
                                  setEditExactGrade(event.target.value)
                                }
                                className={`${selectClassName} !mt-0 w-auto min-w-[8rem] px-2 py-1 text-xs`}
                              >
                                <option value="" disabled>
                                  Select grade
                                </option>
                                {EXACT_GRADES.map((grade) => (
                                  <option key={grade} value={grade}>
                                    {grade === "K"
                                      ? "Kindergarten"
                                      : `Grade ${grade}`}
                                  </option>
                                ))}
                              </select>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveGrade(entry)}
                                  disabled={isSaving}
                                  className={`${btnPrimaryClassName} px-2 py-1 text-xs`}
                                >
                                  {isSaving ? "Saving…" : "Save grade"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingGrade}
                                  disabled={isSaving}
                                  className="text-xs text-muted hover:text-brand-dark disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {manageMode ? (
                            <>
                              <Link
                                href={buildAnalyzeUrl(entry)}
                                aria-label={`Analyze ${resolveDisplayName(entry)}`}
                                title="Analyze"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand transition-colors hover:bg-brand-soft hover:text-brand-dark"
                              >
                                <NewAnalysisIcon />
                              </Link>
                              <button
                                type="button"
                                aria-label={`Remove ${resolveDisplayName(entry)}`}
                                onClick={() => handleDelete(entry)}
                                disabled={deletingUuid === entry.student_uuid}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-error transition-colors hover:bg-red-50 disabled:opacity-50"
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="h-4 w-4"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  aria-label={`Edit ${resolveDisplayName(entry)}`}
                                  aria-expanded={
                                    openMenuUuid === entry.student_uuid
                                  }
                                  aria-haspopup="menu"
                                  onClick={() =>
                                    setOpenMenuUuid((current) =>
                                      current === entry.student_uuid
                                        ? null
                                        : entry.student_uuid,
                                    )
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-brand-soft hover:text-brand-dark"
                                >
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="h-5 w-5"
                                  >
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                                {openMenuUuid === entry.student_uuid && (
                                  <div
                                    role="menu"
                                    className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenMenuUuid(null);
                                        startEditingGrade(entry);
                                      }}
                                      className="block w-full px-3 py-2 text-left text-sm text-brand-dark hover:bg-brand-soft/50"
                                    >
                                      Edit grade
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <Link
                                href={buildAnalyzeUrl(entry)}
                                className={linkClassName}
                              >
                                Analyze
                              </Link>
                              <Link
                                href={`/student/${entry.student_uuid}`}
                                className={linkClassName}
                              >
                                View history
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(entry)}
                                disabled={deletingUuid === entry.student_uuid}
                                className="text-sm text-error hover:text-red-800 disabled:opacity-50"
                              >
                                {deletingUuid === entry.student_uuid
                                  ? "Removing…"
                                  : "Remove"}
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
