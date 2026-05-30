import { z } from "zod";

export const GradeSpanSchema = z.enum(["K", "1-2", "3-12"]);
export type GradeSpan = z.infer<typeof GradeSpanSchema>;

export const ExactGradeSchema = z.enum([
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
]);
export type ExactGrade = z.infer<typeof ExactGradeSchema>;

export function deriveGradeSpan(exactGrade: ExactGrade): GradeSpan {
  if (exactGrade === "K") return "K";
  if (exactGrade === "1" || exactGrade === "2") return "1-2";
  return "3-12";
}

export const ElpacDomainSchema = z.enum([
  "listening",
  "speaking",
  "reading",
  "writing",
]);
export type ElpacDomain = z.infer<typeof ElpacDomainSchema>;

export const ELPAC_DOMAINS = [
  "listening",
  "speaking",
  "reading",
  "writing",
] as const;

export const ENABLED_DOMAINS: ReadonlySet<ElpacDomain> = new Set([
  "writing",
  "reading",
]);

export type PldGradeSpanKey = GradeSpan | "K-2";

export const InsightSchema = z.object({
  strengths: z.string().min(1),
  estimated_level: z.number().int().min(1).max(4),
  level_reasoning: z.string().min(1),
  gap_to_next: z.string().min(1),
  scaffold: z.string().min(1),
});

export type Insight = z.infer<typeof InsightSchema>;

export const TeacherRoleSchema = z.enum(["teacher", "eld_coordinator", "admin"]);
export type TeacherRole = z.infer<typeof TeacherRoleSchema>;

export interface TeacherAccount {
  id: string;
  school_id: string;
  email_hash: string;
  role: TeacherRole;
  created_at: Date;
  last_active_at: Date | null;
}

export interface RosterEntry {
  id: string;
  student_uuid: string;
  label: string;
  subject: string;
  grade_span: GradeSpan;
  exact_grade: ExactGrade | null;
  known_elpac_level: number | null;
  created_at: Date;
  last_updated_at: Date;
}

export interface RosterEntryWithStats extends RosterEntry {
  session_count: number;
  avg_level: number | null;
  last_session_at: Date | null;
}

export interface AnalysisSessionWithInsight {
  id: string;
  student_uuid: string;
  domain: ElpacDomain;
  grade_span: GradeSpan;
  provided_elpac_level: number | null;
  submitted_at: Date;
  insight: Insight;
}

export interface AnalysisSessionDetail extends AnalysisSessionWithInsight {
  subject: string;
  student_label: string;
}

export interface SchoolAccessRow {
  id: string;
  school_id: string;
  school_name: string;
  access_level: "read" | "write";
  granted_at: Date;
}
