import "server-only";

import { NextResponse } from "next/server";
import type { ExactGrade, GradeSpan, TeacherAccount } from "@/lib/types";
import { getPool } from "@/lib/db/pool";

export interface StudentAccess {
  studentUuid: string;
  schoolId: string;
  exactGrade: ExactGrade;
  gradeSpan: GradeSpan;
  grantId: string;
  grantScope: "grade" | "school";
}

export async function getStudentAccess(
  viewerId: string,
  studentUuid: string,
): Promise<StudentAccess | null> {
  const pool = getPool();
  const result = await pool.query<{
    student_uuid: string;
    school_id: string;
    exact_grade: ExactGrade;
    grade_span: GradeSpan;
    grant_id: string;
    grant_scope: "grade" | "school";
  }>(
    `SELECT r.student_uuid, r.school_id, r.exact_grade, r.grade_span, g.id AS grant_id,
            CASE WHEN g.exact_grade IS NULL THEN 'school' ELSE 'grade' END AS grant_scope
     FROM student_roster_entries r
     JOIN grade_grants g
       ON  g.teacher_id = $1
       AND g.school_id = r.school_id
       AND g.revoked_at IS NULL
       AND (g.expires_at IS NULL OR g.expires_at > NOW())
       AND (g.exact_grade IS NULL OR g.exact_grade = r.exact_grade)
     WHERE r.student_uuid = $2
     ORDER BY (g.exact_grade IS NOT NULL) DESC
     LIMIT 1`,
    [viewerId, studentUuid],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    studentUuid: row.student_uuid,
    schoolId: row.school_id,
    exactGrade: row.exact_grade,
    gradeSpan: row.grade_span,
    grantId: row.grant_id,
    grantScope: row.grant_scope,
  };
}

export function isStudentAccessResponse(
  value: StudentAccess | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireStudentAccess(
  teacher: TeacherAccount,
  studentUuid: string,
): Promise<StudentAccess | NextResponse> {
  const access = await getStudentAccess(teacher.id, studentUuid);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return access;
}

export async function requireSessionAccess(
  teacher: TeacherAccount,
  sessionId: string,
): Promise<{ access: StudentAccess; sessionId: string } | NextResponse> {
  const pool = getPool();
  const sessionResult = await pool.query<{ student_uuid: string }>(
    `SELECT student_uuid FROM analysis_sessions WHERE id = $1`,
    [sessionId],
  );
  const sessionRow = sessionResult.rows[0];
  if (!sessionRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await requireStudentAccess(teacher, sessionRow.student_uuid);
  if (isStudentAccessResponse(access)) return access;

  return { access, sessionId };
}

export function isSessionAccessResponse(
  value: { access: StudentAccess; sessionId: string } | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
