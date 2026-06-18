import { normalizeSubject } from "@/lib/roster/display";
import type { GradeSpan } from "@/lib/types";

const GRADE_SPANS: GradeSpan[] = ["K", "1-2", "3-12"];

export interface AnalyzePrefill {
  studentUuid: string;
  subject: string;
  gradeSpan: GradeSpan;
  providedLevel: string;
}

export interface AnalyzeUrlInput {
  student_uuid: string;
  subject: string;
  grade_span: GradeSpan;
  known_elpac_level: number | null;
}

export function buildAnalyzeUrl(entry: AnalyzeUrlInput): string {
  const params = new URLSearchParams();
  params.set("student", entry.student_uuid);

  const trimmedSubject = entry.subject.trim();
  if (trimmedSubject) {
    params.set("subject", normalizeSubject(trimmedSubject));
  }

  params.set("grade_span", entry.grade_span);

  if (entry.known_elpac_level != null) {
    params.set("level", String(entry.known_elpac_level));
  }

  return `/analyze?${params.toString()}`;
}

function parseGradeSpan(value: string | null): GradeSpan | undefined {
  if (value && GRADE_SPANS.includes(value as GradeSpan)) {
    return value as GradeSpan;
  }
  return undefined;
}

function parseProvidedLevel(value: string | null): string {
  if (value && ["1", "2", "3", "4"].includes(value)) {
    return value;
  }
  return "";
}

export function parseAnalyzePrefill(
  searchParams: URLSearchParams,
): AnalyzePrefill | null {
  const studentUuid = searchParams.get("student")?.trim();
  if (!studentUuid) return null;

  const subjectParam = searchParams.get("subject")?.trim();
  const subject = subjectParam ? normalizeSubject(subjectParam) : "All";

  return {
    studentUuid,
    subject: subject || "All",
    gradeSpan: parseGradeSpan(searchParams.get("grade_span")) ?? "3-12",
    providedLevel: parseProvidedLevel(searchParams.get("level")),
  };
}
