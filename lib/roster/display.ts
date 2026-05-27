export function getStudentDisplayName(entry: {
  label: string;
  student_uuid: string;
}): string {
  const trimmed = entry.label.trim();
  if (trimmed) return trimmed;
  return `${entry.student_uuid.slice(0, 8)}…`;
}

export const UNCATEGORIZED_SUBJECT = "Uncategorized";

export function normalizeSubject(subject: string | undefined | null): string {
  const trimmed = subject?.trim();
  return trimmed ? trimmed : UNCATEGORIZED_SUBJECT;
}

export function sortSubjects(subjects: string[]): string[] {
  return [...subjects].sort((a, b) => {
    if (a === UNCATEGORIZED_SUBJECT) return 1;
    if (b === UNCATEGORIZED_SUBJECT) return -1;
    return a.localeCompare(b);
  });
}
