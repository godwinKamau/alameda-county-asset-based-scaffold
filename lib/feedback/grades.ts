import { formatExactGradeLabel } from "@/lib/roster/display";
import type { ExactGrade, GradeGrant } from "@/lib/types";

export const SCHOOL_GRADE_SENTINEL = "school";

const GRADE_ORDER: ExactGrade[] = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

function gradeSortKey(value: string): number {
  if (value === SCHOOL_GRADE_SENTINEL) return -1;
  const index = GRADE_ORDER.indexOf(value as ExactGrade);
  return index === -1 ? 999 : index;
}

export function gradesSnapshotFromGrants(grants: GradeGrant[]): string[] {
  if (grants.length === 0) return [];

  const hasSchoolWide = grants.some((grant) => grant.exact_grade === null);
  if (hasSchoolWide) return [SCHOOL_GRADE_SENTINEL];

  const uniqueGrades = new Set<string>();
  for (const grant of grants) {
    if (grant.exact_grade) {
      uniqueGrades.add(grant.exact_grade);
    }
  }

  return [...uniqueGrades].sort(
    (a, b) => gradeSortKey(a) - gradeSortKey(b),
  );
}

export function formatGradeAccessLabel(snapshot: string[]): string {
  if (snapshot.length === 0) return "No grade access yet";
  if (snapshot.includes(SCHOOL_GRADE_SENTINEL)) {
    return "Whole school (all grades)";
  }

  return snapshot
    .map((value) =>
      value === "K"
        ? "Grade K"
        : formatExactGradeLabel(value as ExactGrade),
    )
    .join(", ");
}
