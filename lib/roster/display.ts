import type { ExactGrade, GradeSpan } from "@/lib/types";

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

export function formatGradeSpanPldLabel(gradeSpan: GradeSpan): string {
  switch (gradeSpan) {
    case "K":
      return "K PLD";
    case "1-2":
      return "Grades 1–2 PLD";
    case "3-12":
      return "Grades 3–12 PLD";
  }
}

export function formatExactGradeLabel(exactGrade: ExactGrade): string {
  return exactGrade === "K" ? "Grade K" : `Grade ${exactGrade}`;
}

export function formatStudentGradeLabel(
  gradeSpan: GradeSpan,
  exactGrade: ExactGrade | null,
): string {
  const pldLabel = formatGradeSpanPldLabel(gradeSpan);
  if (exactGrade) {
    return `${formatExactGradeLabel(exactGrade)} (${pldLabel})`;
  }
  return pldLabel;
}
