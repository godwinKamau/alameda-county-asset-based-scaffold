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

export const InsightSchema = z.object({
  strengths: z.string().min(1),
  estimated_level: z.number().int().min(1).max(4),
  level_reasoning: z.string().min(1),
  gap_to_next: z.string().min(1),
  scaffold: z.string().min(1),
  scaffold_sources: z
    .array(
      z.object({
        chapter: z.number().int().min(3).max(7),
        page: z.number().int().positive(),
        page_end: z.number().int().positive().optional(),
        url: z.string().url(),
        anchor: z.string().optional(),
      }),
    )
    .optional(),
});

export type Insight = z.infer<typeof InsightSchema>;

export const InsightToolSchema = InsightSchema.extend({
  scaffold_source_ids: z.array(z.number().int().positive()).optional(),
});

export type InsightToolOutput = z.infer<typeof InsightToolSchema>;

export type ScaffoldSource = NonNullable<Insight["scaffold_sources"]>[number];

export const RemixScaffoldToolSchema = z.object({
  scaffold: z.string().min(1),
  scaffold_source_ids: z.array(z.number().int().positive()).optional(),
});

export type RemixScaffoldToolOutput = z.infer<typeof RemixScaffoldToolSchema>;

export interface RemixScaffoldResult {
  scaffold: string;
  scaffold_sources?: ScaffoldSource[];
}

export const ScaffoldSourceSchema = z.object({
  chapter: z.number().int().min(3).max(7),
  page: z.number().int().positive(),
  page_end: z.number().int().positive().optional(),
  url: z.string().url(),
  anchor: z.string().optional(),
});

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
  domain: string;
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

export interface SavedInsight {
  id: string;
  scaffold_text: string;
  scaffold_sources?: ScaffoldSource[];
  item_index: number;
  session_id: string;
  student_uuid: string;
  student_label: string;
  estimated_level: number;
  grade_span: GradeSpan;
  submitted_at: Date;
  created_at: Date;
}
