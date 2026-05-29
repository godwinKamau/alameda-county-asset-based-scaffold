"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  formatStudentGradeLabel,
  getStudentDisplayName,
  normalizeSubject,
  sortSubjects,
} from "@/lib/roster/display";
import { EXACT_GRADES } from "@/lib/roster/grade";
import { matchExistingSubject } from "@/lib/roster/subject";
import { buildAnalyzeUrl } from "@/lib/analyze/url";
import { deriveGradeSpan, type ExactGrade, type GradeSpan } from "@/lib/types";
import {
  btnPrimaryClassName,
  inputClassName,
  linkClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { SubjectInput } from "./SubjectInput";

export interface RosterListEntry {
  id: string;
  student_uuid: string;
  label: string;
  subject: string;
  grade_span: GradeSpan;
  exact_grade: ExactGrade | null;
  known_elpac_level: number | null;
}

const GRADE_SPANS: GradeSpan[] = ["K", "1-2", "3-12"];

const LABEL_MAPPING_KEY = "student_label_mapping";

function getLabelMapping(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LABEL_MAPPING_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function removeFromLabelMapping(studentUuid: string): void {
  const mapping = getLabelMapping();
  if (!(studentUuid in mapping)) return;
  delete mapping[studentUuid];
  localStorage.setItem(LABEL_MAPPING_KEY, JSON.stringify(mapping));
}

function resolveDisplayName(
  entry: RosterListEntry,
  mapping: Record<string, string>,
): string {
  const fromDb = entry.label.trim();
  if (fromDb) return fromDb;
  const fromLocal = mapping[entry.student_uuid]?.trim();
  if (fromLocal) return fromLocal;
  return getStudentDisplayName({ label: "", student_uuid: entry.student_uuid });
}

function groupEntriesBySubject(
  entries: RosterListEntry[],
): { subject: string; entries: RosterListEntry[] }[] {
  const groups = new Map<string, RosterListEntry[]>();

  for (const entry of entries) {
    const subject = normalizeSubject(entry.subject);
    const existing = groups.get(subject) ?? [];
    existing.push(entry);
    groups.set(subject, existing);
  }

  return sortSubjects([...groups.keys()]).map((subject) => ({
    subject,
    entries: groups.get(subject) ?? [],
  }));
}

interface RosterListProps {
  entries: RosterListEntry[];
  existingSubjects: string[];
}

export function RosterList({ entries, existingSubjects }: RosterListProps) {
  const router = useRouter();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [editSubjectValue, setEditSubjectValue] = useState("");
  const [editingGradeUuid, setEditingGradeUuid] = useState<string | null>(null);
  const [editExactGrade, setEditExactGrade] = useState("");
  const [editGradeSpan, setEditGradeSpan] = useState<GradeSpan>("3-12");
  const [savingUuid, setSavingUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(
    () => new Set(),
  );

  const groupedEntries = useMemo(
    () => groupEntriesBySubject(entries),
    [entries],
  );

  useEffect(() => {
    setMapping(getLabelMapping());
  }, [entries]);

  function startEditing(entry: RosterListEntry) {
    setEditingUuid(entry.student_uuid);
    setEditSubjectValue(entry.subject.trim());
    setEditingGradeUuid(null);
    setError(null);
  }

  function startEditingGrade(entry: RosterListEntry) {
    setEditingGradeUuid(entry.student_uuid);
    setEditExactGrade(entry.exact_grade ?? "");
    setEditGradeSpan(entry.grade_span);
    setEditingUuid(null);
    setError(null);
  }

  function cancelEditing() {
    setEditingUuid(null);
    setEditSubjectValue("");
  }

  function cancelEditingGrade() {
    setEditingGradeUuid(null);
    setEditExactGrade("");
    setEditGradeSpan("3-12");
  }

  function handleExactGradeChange(value: string) {
    setEditExactGrade(value);
    if (value) {
      setEditGradeSpan(deriveGradeSpan(value as ExactGrade));
    }
  }

  function toggleGroup(subject: string) {
    setCollapsedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  }

  async function handleSaveGrade(entry: RosterListEntry) {
    setError(null);
    setSavingUuid(entry.student_uuid);

    try {
      const response = await fetch(`/api/roster/${entry.student_uuid}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade_span: editGradeSpan,
          exact_grade: editExactGrade || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update grade");
      }

      cancelEditingGrade();
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update grade",
      );
    } finally {
      setSavingUuid(null);
    }
  }

  async function handleSaveSubject(entry: RosterListEntry) {
    setError(null);
    setSavingUuid(entry.student_uuid);

    try {
      const canonicalSubject = matchExistingSubject(
        editSubjectValue,
        existingSubjects,
      );
      const response = await fetch(
        `/api/roster/${entry.student_uuid}/subject`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: canonicalSubject }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update subject");
      }

      setEditingUuid(null);
      setEditSubjectValue("");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update subject",
      );
    } finally {
      setSavingUuid(null);
    }
  }

  async function handleDelete(entry: RosterListEntry) {
    const displayName = resolveDisplayName(entry, mapping);
    const confirmed = window.confirm(
      `Remove ${displayName} from your roster? Their analysis history will also be deleted. This cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setDeletingUuid(entry.student_uuid);

    try {
      const response = await fetch(`/api/roster/${entry.student_uuid}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete student");
      }

      removeFromLabelMapping(entry.student_uuid);
      setMapping(getLabelMapping());
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete student",
      );
    } finally {
      setDeletingUuid(null);
    }
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
          const isCollapsed = collapsedSubjects.has(group.subject);
          const listId = `roster-group-${group.subject.replace(/\s+/g, "-").toLowerCase()}`;

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
              {group.entries.map((entry) => {
                const isEditingSubject = editingUuid === entry.student_uuid;
                const isEditingGrade = editingGradeUuid === entry.student_uuid;
                const isSaving = savingUuid === entry.student_uuid;

                return (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-brand-dark">
                        {resolveDisplayName(entry, mapping)}
                      </p>
                      <p className="text-muted">
                        {formatStudentGradeLabel(
                          entry.grade_span,
                          entry.exact_grade,
                        )}
                        {entry.known_elpac_level != null &&
                          ` · Known level: ${entry.known_elpac_level}`}
                      </p>
                      {isEditingGrade ? (
                        <div className="mt-2 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label
                              htmlFor={`grade-exact-${entry.student_uuid}`}
                              className="sr-only"
                            >
                              Exact grade
                            </label>
                            <select
                              id={`grade-exact-${entry.student_uuid}`}
                              value={editExactGrade}
                              onChange={(event) =>
                                handleExactGradeChange(event.target.value)
                              }
                              className={`${selectClassName} !mt-0 w-auto min-w-[8rem] px-2 py-1 text-xs`}
                            >
                              <option value="">Not set</option>
                              {EXACT_GRADES.map((grade) => (
                                <option key={grade} value={grade}>
                                  {grade === "K" ? "Grade K" : `Grade ${grade}`}
                                </option>
                              ))}
                            </select>
                            <label
                              htmlFor={`grade-span-${entry.student_uuid}`}
                              className="sr-only"
                            >
                              Grade span
                            </label>
                            <select
                              id={`grade-span-${entry.student_uuid}`}
                              value={editGradeSpan}
                              onChange={(event) =>
                                setEditGradeSpan(event.target.value as GradeSpan)
                              }
                              disabled={Boolean(editExactGrade)}
                              className={`${selectClassName} !mt-0 w-auto min-w-[6rem] px-2 py-1 text-xs disabled:opacity-60`}
                            >
                              {GRADE_SPANS.map((span) => (
                                <option key={span} value={span}>
                                  {span} PLD
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveGrade(entry)}
                              disabled={isSaving}
                              className={`${btnPrimaryClassName} px-2 py-1 text-xs`}
                            >
                              {isSaving ? "Saving…" : "Save"}
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
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditingGrade(entry)}
                          className="mt-1 text-xs text-muted hover:text-brand-dark"
                        >
                          Edit grade
                        </button>
                      )}
                      {isEditingSubject ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <SubjectInput
                            value={editSubjectValue}
                            onChange={setEditSubjectValue}
                            existingSubjects={existingSubjects}
                            className="relative min-w-0 flex-1"
                            inputClassName={`${inputClassName} !mt-0 px-2 py-1`}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveSubject(entry)}
                            disabled={isSaving}
                            className={`${btnPrimaryClassName} px-2 py-1 text-xs`}
                          >
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isSaving}
                            className="text-xs text-muted hover:text-brand-dark disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(entry)}
                          className="mt-1 text-xs text-muted hover:text-brand-dark"
                        >
                          Edit subject
                        </button>
                      )}
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
