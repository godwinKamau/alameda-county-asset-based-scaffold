import "server-only";

import type { PoolClient } from "pg";
import { getPool, withTransaction } from "./pool";
import type {
  AnalysisSessionDetail,
  AnalysisSessionWithInsight,
  ExactGrade,
  GradeSpan,
  Insight,
  RosterEntry,
  SchoolAccessRow,
  TeacherAccount,
} from "@/lib/types";
import { decrypt, encrypt } from "@/lib/encryption/aes";

const DEFAULT_SCHOOL_ID = "00000000-0000-4000-8000-000000000002";

export async function findTeacherByEmailHash(
  emailHash: string,
): Promise<TeacherAccount | null> {
  const pool = getPool();
  const result = await pool.query<TeacherAccount>(
    `SELECT id, school_id, email_hash, role, created_at, last_active_at
     FROM teacher_accounts
     WHERE email_hash = $1`,
    [emailHash],
  );
  return result.rows[0] ?? null;
}

export async function createTeacherAccount(
  emailHash: string,
  schoolId: string = DEFAULT_SCHOOL_ID,
): Promise<TeacherAccount> {
  const pool = getPool();
  const result = await pool.query<TeacherAccount>(
    `INSERT INTO teacher_accounts (school_id, email_hash)
     VALUES ($1, $2)
     RETURNING id, school_id, email_hash, role, created_at, last_active_at`,
    [schoolId, emailHash],
  );
  return result.rows[0];
}

export async function touchTeacherLastActive(teacherId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE teacher_accounts SET last_active_at = NOW() WHERE id = $1`,
    [teacherId],
  );
}

export interface CreateRosterRowInput {
  label: string;
  subject?: string;
  grade_span: GradeSpan;
  exact_grade?: ExactGrade | null;
  known_elpac_level?: number | null;
}

export interface CreateRosterRowResult {
  student_uuid: string;
}

export async function createRosterEntries(
  teacherId: string,
  rows: CreateRosterRowInput[],
): Promise<CreateRosterRowResult[]> {
  const pool = getPool();
  const results: CreateRosterRowResult[] = [];

  for (const row of rows) {
    const inserted = await pool.query<{ student_uuid: string }>(
      `INSERT INTO student_roster_entries (teacher_id, label, subject, grade_span, exact_grade, known_elpac_level)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING student_uuid`,
      [
        teacherId,
        row.label.trim(),
        (row.subject ?? "").trim(),
        row.grade_span,
        row.exact_grade ?? null,
        row.known_elpac_level ?? null,
      ],
    );
    results.push({ student_uuid: inserted.rows[0].student_uuid });
  }

  return results;
}

export async function listRosterEntries(teacherId: string): Promise<RosterEntry[]> {
  const pool = getPool();
  const result = await pool.query<RosterEntry>(
    `SELECT id, student_uuid, label, subject, grade_span, exact_grade, known_elpac_level, created_at, last_updated_at
     FROM student_roster_entries
     WHERE teacher_id = $1
     ORDER BY created_at ASC`,
    [teacherId],
  );
  return result.rows;
}

export async function updateRosterEntrySubject(
  teacherId: string,
  studentUuid: string,
  subject: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE student_roster_entries
     SET subject = $3, last_updated_at = NOW()
     WHERE teacher_id = $1 AND student_uuid = $2`,
    [teacherId, studentUuid, subject.trim()],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateRosterEntryGrade(
  teacherId: string,
  studentUuid: string,
  gradeSpan: GradeSpan,
  exactGrade: ExactGrade | null,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE student_roster_entries
     SET grade_span = $3, exact_grade = $4, last_updated_at = NOW()
     WHERE teacher_id = $1 AND student_uuid = $2`,
    [teacherId, studentUuid, gradeSpan, exactGrade],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function rosterEntryBelongsToTeacher(
  teacherId: string,
  studentUuid: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT 1 FROM student_roster_entries
     WHERE teacher_id = $1 AND student_uuid = $2`,
    [teacherId, studentUuid],
  );
  return (result.rowCount ?? 0) > 0;
}

export interface RosterGradeInfo {
  grade_span: GradeSpan;
  exact_grade: ExactGrade | null;
}

export async function getRosterGradeInfo(
  teacherId: string,
  studentUuid: string,
): Promise<RosterGradeInfo | null> {
  const pool = getPool();
  const result = await pool.query<RosterGradeInfo>(
    `SELECT grade_span, exact_grade
     FROM student_roster_entries
     WHERE teacher_id = $1 AND student_uuid = $2`,
    [teacherId, studentUuid],
  );
  return result.rows[0] ?? null;
}

export async function deleteRosterEntry(
  teacherId: string,
  studentUuid: string,
): Promise<boolean> {
  return withTransaction(async (client) => {
    await client.query(
      `DELETE FROM insights
       WHERE session_id IN (
         SELECT id FROM analysis_sessions
         WHERE teacher_id = $1 AND student_uuid = $2
       )`,
      [teacherId, studentUuid],
    );

    await client.query(
      `DELETE FROM analysis_sessions
       WHERE teacher_id = $1 AND student_uuid = $2`,
      [teacherId, studentUuid],
    );

    const deleted = await client.query(
      `DELETE FROM student_roster_entries
       WHERE teacher_id = $1 AND student_uuid = $2`,
      [teacherId, studentUuid],
    );

    return (deleted.rowCount ?? 0) > 0;
  });
}

export interface InsertSessionInput {
  teacherId: string;
  studentUuid: string;
  gradeSpan: GradeSpan;
  exactGrade?: ExactGrade | null;
  providedElpacLevel?: number | null;
  insight: Insight;
}

export async function insertSessionAndInsight(
  input: InsertSessionInput,
): Promise<{ sessionId: string; insight: Insight }> {
  const strengthsEnc = encrypt(input.insight.strengths);
  const reasoningEnc = encrypt(input.insight.level_reasoning);
  const gapEnc = encrypt(input.insight.gap_to_next);
  const scaffoldEnc = encrypt(input.insight.scaffold);

  return withTransaction(async (client: PoolClient) => {
    const sessionResult = await client.query<{ id: string }>(
      `INSERT INTO analysis_sessions
         (teacher_id, student_uuid, domain, grade_span, exact_grade, provided_elpac_level)
       VALUES ($1, $2, 'writing', $3, $4, $5)
       RETURNING id`,
      [
        input.teacherId,
        input.studentUuid,
        input.gradeSpan,
        input.exactGrade ?? null,
        input.providedElpacLevel ?? null,
      ],
    );

    const sessionId = sessionResult.rows[0].id;

    await client.query(
      `INSERT INTO insights (
         session_id,
         strengths_encrypted, strengths_iv,
         estimated_level,
         level_reasoning_encrypted, level_reasoning_iv,
         gap_to_next_encrypted, gap_to_next_iv,
         scaffold_encrypted, scaffold_iv
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        sessionId,
        strengthsEnc.ciphertext,
        strengthsEnc.iv,
        input.insight.estimated_level,
        reasoningEnc.ciphertext,
        reasoningEnc.iv,
        gapEnc.ciphertext,
        gapEnc.iv,
        scaffoldEnc.ciphertext,
        scaffoldEnc.iv,
      ],
    );

    return { sessionId, insight: input.insight };
  });
}

function decryptInsightRow(row: {
  estimated_level: number;
  strengths_encrypted: string;
  strengths_iv: string;
  level_reasoning_encrypted: string;
  level_reasoning_iv: string;
  gap_to_next_encrypted: string;
  gap_to_next_iv: string;
  scaffold_encrypted: string;
  scaffold_iv: string;
}): Insight {
  return {
    strengths: decrypt({
      ciphertext: row.strengths_encrypted,
      iv: row.strengths_iv,
    }),
    estimated_level: row.estimated_level,
    level_reasoning: decrypt({
      ciphertext: row.level_reasoning_encrypted,
      iv: row.level_reasoning_iv,
    }),
    gap_to_next: decrypt({
      ciphertext: row.gap_to_next_encrypted,
      iv: row.gap_to_next_iv,
    }),
    scaffold: decrypt({
      ciphertext: row.scaffold_encrypted,
      iv: row.scaffold_iv,
    }),
  };
}

export async function listSessionsForStudent(
  teacherId: string,
  studentUuid: string,
): Promise<AnalysisSessionWithInsight[]> {
  const pool = getPool();
  const result = await pool.query<
    AnalysisSessionWithInsight & {
      strengths_encrypted: string;
      strengths_iv: string;
      level_reasoning_encrypted: string;
      level_reasoning_iv: string;
      gap_to_next_encrypted: string;
      gap_to_next_iv: string;
      scaffold_encrypted: string;
      scaffold_iv: string;
      estimated_level: number;
    }
  >(
    `SELECT
       s.id,
       s.student_uuid,
       s.domain,
       s.grade_span,
       s.provided_elpac_level,
       s.submitted_at,
       i.estimated_level,
       i.strengths_encrypted,
       i.strengths_iv,
       i.level_reasoning_encrypted,
       i.level_reasoning_iv,
       i.gap_to_next_encrypted,
       i.gap_to_next_iv,
       i.scaffold_encrypted,
       i.scaffold_iv
     FROM analysis_sessions s
     JOIN insights i ON i.session_id = s.id
     WHERE s.teacher_id = $1 AND s.student_uuid = $2
     ORDER BY s.submitted_at ASC`,
    [teacherId, studentUuid],
  );

  return result.rows.map((row) => ({
    id: row.id,
    student_uuid: row.student_uuid,
    domain: row.domain,
    grade_span: row.grade_span as GradeSpan,
    provided_elpac_level: row.provided_elpac_level,
    submitted_at: row.submitted_at,
    insight: decryptInsightRow(row),
  }));
}

export async function getSessionWithInsight(
  teacherId: string,
  sessionId: string,
): Promise<AnalysisSessionDetail | null> {
  const pool = getPool();
  const result = await pool.query<
    AnalysisSessionWithInsight & {
      subject: string;
      student_label: string;
      strengths_encrypted: string;
      strengths_iv: string;
      level_reasoning_encrypted: string;
      level_reasoning_iv: string;
      gap_to_next_encrypted: string;
      gap_to_next_iv: string;
      scaffold_encrypted: string;
      scaffold_iv: string;
      estimated_level: number;
    }
  >(
    `SELECT
       s.id,
       s.student_uuid,
       s.domain,
       s.grade_span,
       s.provided_elpac_level,
       s.submitted_at,
       COALESCE(r.subject, '') AS subject,
       COALESCE(r.label, '') AS student_label,
       i.estimated_level,
       i.strengths_encrypted,
       i.strengths_iv,
       i.level_reasoning_encrypted,
       i.level_reasoning_iv,
       i.gap_to_next_encrypted,
       i.gap_to_next_iv,
       i.scaffold_encrypted,
       i.scaffold_iv
     FROM analysis_sessions s
     JOIN insights i ON i.session_id = s.id
     LEFT JOIN student_roster_entries r
       ON r.teacher_id = s.teacher_id AND r.student_uuid = s.student_uuid
     WHERE s.teacher_id = $1 AND s.id = $2`,
    [teacherId, sessionId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    student_uuid: row.student_uuid,
    domain: row.domain,
    grade_span: row.grade_span as GradeSpan,
    provided_elpac_level: row.provided_elpac_level,
    submitted_at: row.submitted_at,
    subject: row.subject,
    student_label: row.student_label,
    insight: decryptInsightRow(row),
  };
}

export async function listSchoolAccessForTeacher(
  teacherId: string,
): Promise<SchoolAccessRow[]> {
  const pool = getPool();
  const result = await pool.query<SchoolAccessRow>(
    `SELECT sa.id, sa.school_id, sc.name AS school_name, sa.access_level, sa.granted_at
     FROM school_access sa
     JOIN schools sc ON sc.id = sa.school_id
     WHERE sa.teacher_id = $1
     ORDER BY sa.granted_at DESC`,
    [teacherId],
  );
  return result.rows;
}
