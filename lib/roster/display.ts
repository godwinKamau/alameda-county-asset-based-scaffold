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

export function getInitials(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "";
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;

  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
}
