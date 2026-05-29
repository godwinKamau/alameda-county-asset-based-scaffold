import {
  deriveGradeSpan,
  ExactGradeSchema,
  GradeSpanSchema,
  type ExactGrade,
  type GradeSpan,
} from "@/lib/types";

export const EXACT_GRADES = ExactGradeSchema.options;

export interface ResolvedGradeFields {
  grade_span: GradeSpan;
  exact_grade: ExactGrade | null;
}

export function resolveRosterGradeFields(input: {
  grade_span?: string | null;
  exact_grade?: string | null;
}): ResolvedGradeFields {
  const exactGradeRaw = input.exact_grade?.trim() ?? "";
  const gradeSpanRaw = input.grade_span?.trim() ?? "";

  const exactGrade = exactGradeRaw
    ? ExactGradeSchema.parse(exactGradeRaw)
    : null;

  let gradeSpan: GradeSpan;
  if (gradeSpanRaw) {
    gradeSpan = GradeSpanSchema.parse(gradeSpanRaw);
  } else if (exactGrade) {
    gradeSpan = deriveGradeSpan(exactGrade);
  } else {
    throw new Error("grade_span or exact_grade is required");
  }

  if (exactGrade && gradeSpanRaw) {
    const derived = deriveGradeSpan(exactGrade);
    if (derived !== gradeSpan) {
      throw new Error(
        `exact_grade '${exactGrade}' conflicts with grade_span '${gradeSpan}'`,
      );
    }
  }

  return { grade_span: gradeSpan, exact_grade: exactGrade };
}
