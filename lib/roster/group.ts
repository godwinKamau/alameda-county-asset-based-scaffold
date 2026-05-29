import {
  getStudentDisplayName,
  normalizeSubject,
  sortSubjects,
} from "@/lib/roster/display";

export const LABEL_MAPPING_KEY = "student_label_mapping";

export interface StudentDisplayEntry {
  label: string;
  student_uuid: string;
}

export function getLabelMapping(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LABEL_MAPPING_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function removeFromLabelMapping(studentUuid: string): void {
  if (typeof window === "undefined") return;
  const mapping = getLabelMapping();
  if (!(studentUuid in mapping)) return;
  delete mapping[studentUuid];
  localStorage.setItem(LABEL_MAPPING_KEY, JSON.stringify(mapping));
}

export function resolveDisplayName(
  entry: StudentDisplayEntry,
  mapping: Record<string, string>,
): string {
  const fromDb = entry.label.trim();
  if (fromDb) return fromDb;
  const fromLocal = mapping[entry.student_uuid]?.trim();
  if (fromLocal) return fromLocal;
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
