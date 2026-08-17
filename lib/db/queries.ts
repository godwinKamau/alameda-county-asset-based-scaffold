import "server-only";

import { createHash } from "crypto";
import type { PoolClient } from "pg";
import { getPool, withTransaction } from "./pool";
import type {
  AnalysisSessionDetail,
  AnalysisSessionWithInsight,
  ExactGrade,
  GradeSpan,
  Insight,
  RosterEntry,
  RosterEntryWithStats,
  SavedInsight,
  ScaffoldSource,
  TeacherAccount,
} from "@/lib/types";
import { decrypt, encrypt } from "@/lib/encryption/aes";
import { distributeScaffoldSources } from "@/lib/framework/sources";
import { parseScaffoldItems } from "@/lib/scaffold/format";

const DEFAULT_SCHOOL_ID = "00000000-0000-4000-8000-000000000002";

function parseScaffoldSources(value: unknown): ScaffoldSource[] | undefined {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  return value as ScaffoldSource[];
}

function decryptRosterLabel(row: {
  label?: string | null;
  label_encrypted?: string | null;
  label_iv?: string | null;
}): string {
  if (row.label_encrypted && row.label_iv) {
    return decrypt({
      ciphertext: row.label_encrypted,
      iv: row.label_iv,
    });
  }
  return row.label?.trim() ?? "";
}

function encryptRosterLabel(label: string) {
  const trimmed = label.trim();
  return {
    plaintext: trimmed,
    encrypted: encrypt(trimmed),
  };
}

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
  schoolId?: string,
): Promise<CreateRosterRowResult[]> {
  const pool = getPool();
  const results: CreateRosterRowResult[] = [];

  let resolvedSchoolId = schoolId;
  if (!resolvedSchoolId) {
    const teacherRow = await pool.query<{ school_id: string }>(
      `SELECT school_id FROM teacher_accounts WHERE id = $1`,
      [teacherId],
    );
    resolvedSchoolId = teacherRow.rows[0]?.school_id;
    if (!resolvedSchoolId) {
      throw new Error("Teacher school not found for roster creation");
    }
  }

  for (const row of rows) {
    const labelPayload = encryptRosterLabel(row.label);
    const inserted = await pool.query<{ student_uuid: string }>(
      `INSERT INTO student_roster_entries (
         teacher_id, school_id, label_encrypted, label_iv,
         subject, grade_span, exact_grade, known_elpac_level
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING student_uuid`,
      [
        teacherId,
        resolvedSchoolId,
        labelPayload.encrypted.ciphertext,
        labelPayload.encrypted.iv,
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

export async function listRosterEntries(viewerId: string): Promise<RosterEntry[]> {
  const pool = getPool();
  const result = await pool.query<
    RosterEntry & {
      label_encrypted: string | null;
      label_iv: string | null;
    }
  >(
    `SELECT r.id, r.student_uuid, r.label_encrypted, r.label_iv, r.subject,
            r.grade_span, r.exact_grade, r.known_elpac_level, r.created_at, r.last_updated_at
     FROM student_roster_entries r
     JOIN grade_grants g
       ON  g.teacher_id = $1
       AND g.school_id = r.school_id
       AND g.revoked_at IS NULL
       AND (g.expires_at IS NULL OR g.expires_at > NOW())
       AND (g.exact_grade IS NULL OR g.exact_grade = r.exact_grade)
     ORDER BY r.created_at ASC`,
    [viewerId],
  );
  return result.rows.map((row) => ({
    ...row,
    label: decryptRosterLabel(row),
  }));
}

export async function listAccessibleRosterEntriesWithStats(
  viewerId: string,
): Promise<RosterEntryWithStats[]> {
  const pool = getPool();
  const result = await pool.query<
    RosterEntryWithStats & {
      avg_level: string | null;
      label_encrypted: string | null;
      label_iv: string | null;
    }
  >(
    `SELECT
       r.id,
       r.student_uuid,
       r.label_encrypted,
       r.label_iv,
       r.subject,
       r.grade_span,
       r.exact_grade,
       r.known_elpac_level,
       r.created_at,
       r.last_updated_at,
       COUNT(s.id)::int AS session_count,
       AVG(i.estimated_level) AS avg_level,
       MAX(s.submitted_at) AS last_session_at
     FROM student_roster_entries r
     JOIN grade_grants g
       ON  g.teacher_id = $1
       AND g.school_id = r.school_id
       AND g.revoked_at IS NULL
       AND (g.expires_at IS NULL OR g.expires_at > NOW())
       AND (g.exact_grade IS NULL OR g.exact_grade = r.exact_grade)
     LEFT JOIN analysis_sessions s
       ON s.student_uuid = r.student_uuid
     LEFT JOIN insights i ON i.session_id = s.id
     GROUP BY r.id
     ORDER BY r.created_at ASC`,
    [viewerId],
  );

  return result.rows.map((row) => ({
    ...row,
    label: decryptRosterLabel(row),
    avg_level: row.avg_level != null ? Number(row.avg_level) : null,
  }));
}

export async function listRosterEntriesWithStats(
  teacherId: string,
): Promise<RosterEntryWithStats[]> {
  return listAccessibleRosterEntriesWithStats(teacherId);
}

export interface StudentMissingGrade {
  id: string;
  student_uuid: string;
  label: string;
  subject: string;
  grade_span: GradeSpan;
  known_elpac_level: number | null;
  created_at: Date;
}

export async function listStudentsMissingGrade(
  schoolId: string,
): Promise<StudentMissingGrade[]> {
  const pool = getPool();
  const result = await pool.query<
    StudentMissingGrade & {
      label_encrypted: string | null;
      label_iv: string | null;
    }
  >(
    `SELECT id, student_uuid, label_encrypted, label_iv, subject, grade_span,
            known_elpac_level, created_at
     FROM student_roster_entries
     WHERE school_id = $1 AND exact_grade IS NULL
     ORDER BY created_at ASC`,
    [schoolId],
  );
  return result.rows.map((row) => ({
    ...row,
    label: decryptRosterLabel(row),
    grade_span: row.grade_span as GradeSpan,
  }));
}

export async function setStudentGrade(
  schoolId: string,
  studentUuid: string,
  exactGrade: ExactGrade,
  gradeSpan: GradeSpan,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE student_roster_entries
     SET exact_grade = $3, grade_span = $4, last_updated_at = NOW()
     WHERE school_id = $1 AND student_uuid = $2 AND exact_grade IS NULL`,
    [schoolId, studentUuid, exactGrade, gradeSpan],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function countStudentsMissingGrade(
  schoolId: string,
): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM student_roster_entries
     WHERE school_id = $1 AND exact_grade IS NULL`,
    [schoolId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getRosterEntryLabel(
  studentUuid: string,
): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{
    label_encrypted: string | null;
    label_iv: string | null;
  }>(
    `SELECT label_encrypted, label_iv
     FROM student_roster_entries
     WHERE student_uuid = $1`,
    [studentUuid],
  );
  const row = result.rows[0];
  if (!row) return null;
  const label = decryptRosterLabel(row);
  return label || null;
}

export async function listSchoolRosterEntries(
  schoolId: string,
): Promise<RosterEntry[]> {
  const pool = getPool();
  const result = await pool.query<
    RosterEntry & {
      label_encrypted: string | null;
      label_iv: string | null;
    }
  >(
    `SELECT id, student_uuid, label_encrypted, label_iv, subject, grade_span,
            exact_grade, known_elpac_level, created_at, last_updated_at
     FROM student_roster_entries
     WHERE school_id = $1
     ORDER BY created_at ASC`,
    [schoolId],
  );
  return result.rows.map((row) => ({
    ...row,
    label: decryptRosterLabel(row),
  }));
}

export async function updateRosterEntryLabelBySchool(
  schoolId: string,
  studentUuid: string,
  label: string,
): Promise<boolean> {
  const pool = getPool();
  const labelPayload = encryptRosterLabel(label);
  const result = await pool.query(
    `UPDATE student_roster_entries
     SET label_encrypted = $3, label_iv = $4, last_updated_at = NOW()
     WHERE school_id = $1 AND student_uuid = $2`,
    [
      schoolId,
      studentUuid,
      labelPayload.encrypted.ciphertext,
      labelPayload.encrypted.iv,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateRosterEntrySubjectBySchool(
  schoolId: string,
  studentUuid: string,
  subject: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE student_roster_entries
     SET subject = $3, last_updated_at = NOW()
     WHERE school_id = $1 AND student_uuid = $2`,
    [schoolId, studentUuid, subject.trim()],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateRosterEntryGradeBySchool(
  schoolId: string,
  studentUuid: string,
  gradeSpan: GradeSpan,
  exactGrade: ExactGrade,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE student_roster_entries
     SET grade_span = $3, exact_grade = $4, last_updated_at = NOW()
     WHERE school_id = $1 AND student_uuid = $2`,
    [schoolId, studentUuid, gradeSpan, exactGrade],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function countOtherTeachersSessionsForStudent(
  schoolId: string,
  studentUuid: string,
  excludingTeacherId: string,
): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM analysis_sessions s
     JOIN student_roster_entries r ON r.student_uuid = s.student_uuid
     WHERE r.school_id = $1 AND s.student_uuid = $2 AND s.teacher_id <> $3`,
    [schoolId, studentUuid, excludingTeacherId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function deleteRosterEntryBySchool(
  schoolId: string,
  studentUuid: string,
): Promise<boolean> {
  return withTransaction(async (client) => {
    await client.query(
      `DELETE FROM insights
       WHERE session_id IN (
         SELECT id FROM analysis_sessions WHERE student_uuid = $2
       )`,
      [schoolId, studentUuid],
    );

    await client.query(
      `DELETE FROM analysis_sessions WHERE student_uuid = $2`,
      [schoolId, studentUuid],
    );

    const deleted = await client.query(
      `DELETE FROM student_roster_entries
       WHERE school_id = $1 AND student_uuid = $2`,
      [schoolId, studentUuid],
    );

    return (deleted.rowCount ?? 0) > 0;
  });
}

export async function rosterEntryInSchool(
  schoolId: string,
  studentUuid: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT 1 FROM student_roster_entries
     WHERE school_id = $1 AND student_uuid = $2`,
    [schoolId, studentUuid],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateRosterEntryLabel(
  teacherId: string,
  studentUuid: string,
  label: string,
): Promise<boolean> {
  const pool = getPool();
  const labelPayload = encryptRosterLabel(label);
  const result = await pool.query(
    `UPDATE student_roster_entries
     SET label_encrypted = $3, label_iv = $4, last_updated_at = NOW()
     WHERE teacher_id = $1 AND student_uuid = $2`,
    [
      teacherId,
      studentUuid,
      labelPayload.encrypted.ciphertext,
      labelPayload.encrypted.iv,
    ],
  );
  return (result.rowCount ?? 0) > 0;
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
  domain: import("@/lib/elpac/domain").ElpacDomain;
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
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.teacherId,
        input.studentUuid,
        input.domain,
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
         scaffold_encrypted, scaffold_iv,
         scaffold_sources
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
        input.insight.scaffold_sources?.length
          ? JSON.stringify(input.insight.scaffold_sources)
          : null,
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
  scaffold_sources?: unknown;
}): Insight {
  const scaffoldSources = parseScaffoldSources(row.scaffold_sources);
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
    ...(scaffoldSources ? { scaffold_sources: scaffoldSources } : {}),
  };
}

export async function listSessionsForStudent(
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
       s.teacher_id,
       i.estimated_level,
       i.strengths_encrypted,
       i.strengths_iv,
       i.level_reasoning_encrypted,
       i.level_reasoning_iv,
       i.gap_to_next_encrypted,
       i.gap_to_next_iv,
       i.scaffold_encrypted,
       i.scaffold_iv,
       i.scaffold_sources
     FROM analysis_sessions s
     JOIN insights i ON i.session_id = s.id
     WHERE s.student_uuid = $1
     ORDER BY s.submitted_at ASC`,
    [studentUuid],
  );

  return result.rows.map((row) => ({
    id: row.id,
    student_uuid: row.student_uuid,
    domain: row.domain,
    grade_span: row.grade_span as GradeSpan,
    provided_elpac_level: row.provided_elpac_level,
    submitted_at: row.submitted_at,
    teacher_id: (row as { teacher_id: string }).teacher_id,
    insight: decryptInsightRow(row),
  }));
}

export async function getSessionWithInsight(
  sessionId: string,
): Promise<AnalysisSessionDetail | null> {
  const pool = getPool();
  const result = await pool.query<
    AnalysisSessionWithInsight & {
      subject: string;
      label_encrypted: string | null;
      label_iv: string | null;
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
       r.label_encrypted,
       r.label_iv,
       i.estimated_level,
       i.strengths_encrypted,
       i.strengths_iv,
       i.level_reasoning_encrypted,
       i.level_reasoning_iv,
       i.gap_to_next_encrypted,
       i.gap_to_next_iv,
       i.scaffold_encrypted,
       i.scaffold_iv,
       i.scaffold_sources
     FROM analysis_sessions s
     JOIN insights i ON i.session_id = s.id
     LEFT JOIN student_roster_entries r ON r.student_uuid = s.student_uuid
     WHERE s.id = $1`,
    [sessionId],
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
    student_label: decryptRosterLabel(row),
    insight: decryptInsightRow(row),
  };
}

export async function listDomainLevelsByTeacherForStudent(
  studentUuid: string,
): Promise<
  {
    teacher_id: string;
    domain: string;
    avg_level: number;
    session_count: number;
  }[]
> {
  const pool = getPool();
  const result = await pool.query<{
    teacher_id: string;
    domain: string;
    avg_level: string;
    session_count: string;
  }>(
    `SELECT s.teacher_id, s.domain,
            AVG(i.estimated_level) AS avg_level,
            COUNT(*)::int AS session_count
     FROM analysis_sessions s
     JOIN insights i ON i.session_id = s.id
     WHERE s.student_uuid = $1
     GROUP BY s.teacher_id, s.domain
     ORDER BY s.teacher_id, s.domain`,
    [studentUuid],
  );
  return result.rows.map((row) => ({
    teacher_id: row.teacher_id,
    domain: row.domain,
    avg_level: Number(row.avg_level),
    session_count: Number(row.session_count),
  }));
}

export async function listDomainLevelsForTeacherStudents(
  teacherId: string,
): Promise<
  {
    student_uuid: string;
    domain: string;
    avg_level: number;
  }[]
> {
  const pool = getPool();
  const result = await pool.query<{
    student_uuid: string;
    domain: string;
    avg_level: string;
  }>(
    `SELECT s.student_uuid, s.domain, AVG(i.estimated_level) AS avg_level
     FROM analysis_sessions s
     JOIN insights i ON i.session_id = s.id
     WHERE EXISTS (
       SELECT 1
       FROM student_roster_entries r
       JOIN grade_grants g
         ON  g.teacher_id = $1
         AND g.school_id = r.school_id
         AND g.revoked_at IS NULL
         AND (g.expires_at IS NULL OR g.expires_at > NOW())
         AND (g.exact_grade IS NULL OR g.exact_grade = r.exact_grade)
       WHERE r.student_uuid = s.student_uuid
     )
     GROUP BY s.student_uuid, s.domain
     ORDER BY s.student_uuid, s.domain`,
    [teacherId],
  );
  return result.rows.map((row) => ({
    student_uuid: row.student_uuid,
    domain: row.domain,
    avg_level: Number(row.avg_level),
  }));
}

export async function listLatestAnalysisForAccessibleStudents(
  teacherId: string,
): Promise<
  {
    student_uuid: string;
    domain: string;
    estimated_level: number;
    submitted_at: Date;
  }[]
> {
  const pool = getPool();
  const result = await pool.query<{
    student_uuid: string;
    domain: string;
    estimated_level: number;
    submitted_at: Date;
  }>(
    `SELECT DISTINCT ON (s.student_uuid)
       s.student_uuid,
       s.domain,
       i.estimated_level,
       s.submitted_at
     FROM analysis_sessions s
     JOIN insights i ON i.session_id = s.id
     WHERE EXISTS (
       SELECT 1
       FROM student_roster_entries r
       JOIN grade_grants g
         ON  g.teacher_id = $1
         AND g.school_id = r.school_id
         AND g.revoked_at IS NULL
         AND (g.expires_at IS NULL OR g.expires_at > NOW())
         AND (g.exact_grade IS NULL OR g.exact_grade = r.exact_grade)
       WHERE r.student_uuid = s.student_uuid
     )
     ORDER BY s.student_uuid, s.submitted_at DESC`,
    [teacherId],
  );

  return result.rows.map((row) => ({
    student_uuid: row.student_uuid,
    domain: row.domain,
    estimated_level: row.estimated_level,
    submitted_at: row.submitted_at,
  }));
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function extractScaffoldItem(
  insight: Insight,
  itemIndex: number,
): { text: string; sources: ScaffoldSource[] } | null {
  const items = parseScaffoldItems(insight.scaffold);
  if (itemIndex < 0 || itemIndex >= items.length) {
    return null;
  }

  const sourcesByItem = distributeScaffoldSources(
    items.length,
    insight.scaffold_sources ?? [],
  );

  return {
    text: items[itemIndex],
    sources: sourcesByItem[itemIndex] ?? [],
  };
}

export interface SaveScaffoldInsightOverride {
  text: string;
  sources?: ScaffoldSource[];
}

export async function saveScaffoldInsight(
  teacherId: string,
  sessionId: string,
  itemIndex: number,
  override?: SaveScaffoldInsightOverride,
): Promise<boolean> {
  let text: string;
  let sources: ScaffoldSource[];

  if (override) {
    text = override.text;
    sources = override.sources ?? [];
  } else {
    const session = await getSessionWithInsight(sessionId);
    if (!session) {
      return false;
    }

    const item = extractScaffoldItem(session.insight, itemIndex);
    if (!item) {
      return false;
    }

    text = item.text;
    sources = item.sources;
  }

  const contentHash = sha256Hex(text);
  const encrypted = encrypt(text);
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO saved_insights (
       teacher_id,
       session_id,
       item_index,
       content_hash,
       scaffold_text_encrypted,
       scaffold_text_iv,
       scaffold_sources
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (teacher_id, session_id, content_hash) DO NOTHING`,
    [
      teacherId,
      sessionId,
      itemIndex,
      contentHash,
      encrypted.ciphertext,
      encrypted.iv,
      sources.length ? JSON.stringify(sources) : null,
    ],
  );

  if ((result.rowCount ?? 0) > 0) {
    return true;
  }

  const existing = await pool.query(
    `SELECT 1 FROM saved_insights
     WHERE teacher_id = $1 AND session_id = $2 AND content_hash = $3`,
    [teacherId, sessionId, contentHash],
  );
  return (existing.rowCount ?? 0) > 0;
}

export async function deleteScaffoldInsight(
  teacherId: string,
  sessionId: string,
  itemIndex: number,
  override?: { text: string },
): Promise<boolean> {
  let text: string;

  if (override) {
    text = override.text;
  } else {
    const session = await getSessionWithInsight(sessionId);
    if (!session) {
      return false;
    }

    const item = extractScaffoldItem(session.insight, itemIndex);
    if (!item) {
      return false;
    }

    text = item.text;
  }

  const contentHash = sha256Hex(text);
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM saved_insights
     WHERE teacher_id = $1 AND session_id = $2 AND content_hash = $3`,
    [teacherId, sessionId, contentHash],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listSavedItemIndicesForSession(
  teacherId: string,
  sessionId: string,
): Promise<number[]> {
  const session = await getSessionWithInsight(sessionId);
  if (!session) {
    return [];
  }

  const items = parseScaffoldItems(session.insight.scaffold);
  if (items.length === 0) {
    return [];
  }

  const itemHashes = items.map((item) => sha256Hex(item));
  const pool = getPool();
  const result = await pool.query<{ content_hash: string }>(
    `SELECT content_hash
     FROM saved_insights
     WHERE teacher_id = $1 AND session_id = $2`,
    [teacherId, sessionId],
  );

  const savedHashes = new Set(result.rows.map((row) => row.content_hash));
  return itemHashes
    .map((hash, index) => (savedHashes.has(hash) ? index : -1))
    .filter((index) => index >= 0);
}

export async function listSavedInsights(
  teacherId: string,
): Promise<SavedInsight[]> {
  const pool = getPool();
  const result = await pool.query<
    SavedInsight & {
      scaffold_text_encrypted: string;
      scaffold_text_iv: string;
      scaffold_sources: unknown;
      label_encrypted: string | null;
      label_iv: string | null;
    }
  >(
    `SELECT
       si.id,
       si.item_index,
       si.session_id,
       si.scaffold_text_encrypted,
       si.scaffold_text_iv,
       si.scaffold_sources,
       si.created_at,
       s.student_uuid,
       s.grade_span,
       s.submitted_at,
       r.label_encrypted,
       r.label_iv,
       i.estimated_level
     FROM saved_insights si
     JOIN analysis_sessions s ON s.id = si.session_id
     JOIN insights i ON i.session_id = s.id
     LEFT JOIN student_roster_entries r ON r.student_uuid = s.student_uuid
     WHERE si.teacher_id = $1
     ORDER BY si.created_at DESC`,
    [teacherId],
  );

  return result.rows.map((row) => {
    const scaffoldSources = parseScaffoldSources(row.scaffold_sources);
    return {
      id: row.id,
      scaffold_text: decrypt({
        ciphertext: row.scaffold_text_encrypted,
        iv: row.scaffold_text_iv,
      }),
      ...(scaffoldSources ? { scaffold_sources: scaffoldSources } : {}),
      item_index: row.item_index,
      session_id: row.session_id,
      student_uuid: row.student_uuid,
      student_label: decryptRosterLabel(row),
      estimated_level: row.estimated_level,
      grade_span: row.grade_span as GradeSpan,
      submitted_at: row.submitted_at,
      created_at: row.created_at,
    };
  });
}
