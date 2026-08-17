import {
  formatExactGradeLabel,
  getStudentDisplayName,
  normalizeSubject,
  sortSubjects,
} from "@/lib/roster/display";
import { EXACT_GRADES } from "@/lib/roster/grade";
import type { ExactGrade } from "@/lib/types";

export interface StudentDisplayEntry {
  label: string;
  student_uuid: string;
}

export function resolveDisplayName(entry: StudentDisplayEntry): string {
  const fromDb = entry.label.trim();
  if (fromDb) return fromDb;
  return getStudentDisplayName({ label: "", student_uuid: entry.student_uuid });
}

export function groupEntriesBySubject<T extends { subject: string }>(
  entries: T[],
): { subject: string; entries: T[] }[] {
  const groups = new Map<string, T[]>();

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

export function groupEntriesByExactGrade<
  T extends { exact_grade: ExactGrade | null },
>(entries: T[]): { label: string; entries: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const entry of entries) {
    const key = entry.exact_grade ?? "unknown";
    const existing = groups.get(key) ?? [];
    existing.push(entry);
    groups.set(key, existing);
  }

  const orderedKeys = [
    ...EXACT_GRADES.filter((grade) => groups.has(grade)),
    ...(groups.has("unknown") ? (["unknown"] as const) : []),
  ];

  return orderedKeys.map((key) => ({
    label:
      key === "unknown"
        ? "Grade not set"
        : formatExactGradeLabel(key as ExactGrade),
    entries: groups.get(key) ?? [],
  }));
}
