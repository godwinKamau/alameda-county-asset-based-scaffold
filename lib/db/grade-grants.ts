import "server-only";

import { getPool, withTransaction } from "./pool";
import type { ExactGrade, GradeGrant, GradeAccessRequest } from "@/lib/types";
import { decrypt, encrypt } from "@/lib/encryption/aes";

function decryptOptionalText(
  encrypted: string | null,
  iv: string | null,
): string | null {
  if (!encrypted || !iv) return null;
  return decrypt({ ciphertext: encrypted, iv });
}

export async function listGrantsForTeacher(
  teacherId: string,
): Promise<GradeGrant[]> {
  const pool = getPool();
  const result = await pool.query<GradeGrant>(
    `SELECT id, teacher_id, school_id, exact_grade, granted_by, granted_at,
            expires_at, revoked_at, revoked_by, origin, request_id, note
     FROM grade_grants
     WHERE teacher_id = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY granted_at DESC`,
    [teacherId],
  );
  return result.rows.map((row) => ({
    ...row,
    exact_grade: row.exact_grade as ExactGrade | null,
  }));
}

export async function listActiveGrantsForSchool(
  schoolId: string,
): Promise<GradeGrant[]> {
  const pool = getPool();
  const result = await pool.query<GradeGrant>(
    `SELECT id, teacher_id, school_id, exact_grade, granted_by, granted_at,
            expires_at, revoked_at, revoked_by, origin, request_id, note
     FROM grade_grants
     WHERE school_id = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY granted_at DESC`,
    [schoolId],
  );
  return result.rows.map((row) => ({
    ...row,
    exact_grade: row.exact_grade as ExactGrade | null,
  }));
}

export async function createGrant(
  adminId: string,
  input: {
    teacherId: string;
    schoolId: string;
    exactGrade?: ExactGrade | null;
    expiresAt?: Date | null;
    note?: string | null;
    origin?: GradeGrant["origin"];
    requestId?: string | null;
  },
): Promise<GradeGrant> {
  const pool = getPool();
  const result = await pool.query<GradeGrant>(
    `INSERT INTO grade_grants (
       teacher_id, school_id, exact_grade, granted_by, expires_at, note, origin, request_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, teacher_id, school_id, exact_grade, granted_by, granted_at,
               expires_at, revoked_at, revoked_by, origin, request_id, note`,
    [
      input.teacherId,
      input.schoolId,
      input.exactGrade ?? null,
      adminId,
      input.expiresAt ?? null,
      input.note ?? null,
      input.origin ?? "admin",
      input.requestId ?? null,
    ],
  );
  const row = result.rows[0];
  return {
    ...row,
    exact_grade: row.exact_grade as ExactGrade | null,
  };
}

export async function revokeGrant(
  adminId: string,
  grantId: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE grade_grants
     SET revoked_at = NOW(), revoked_by = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [grantId, adminId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listPendingRequests(
  schoolId: string,
): Promise<GradeAccessRequest[]> {
  const pool = getPool();
  const result = await pool.query<
    GradeAccessRequest & {
      reason_encrypted: string | null;
      reason_iv: string | null;
      decision_note_encrypted: string | null;
      decision_note_iv: string | null;
    }
  >(
    `SELECT id, teacher_id, school_id, exact_grade, reason_encrypted, reason_iv,
            status, requested_at, decided_at, decided_by,
            decision_note_encrypted, decision_note_iv
     FROM grade_access_requests
     WHERE school_id = $1 AND status = 'pending'
     ORDER BY requested_at ASC`,
    [schoolId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    teacher_id: row.teacher_id,
    school_id: row.school_id,
    exact_grade: row.exact_grade as ExactGrade | null,
    reason: decryptOptionalText(row.reason_encrypted, row.reason_iv),
    status: row.status,
    requested_at: row.requested_at,
    decided_at: row.decided_at,
    decided_by: row.decided_by,
    decision_note: decryptOptionalText(
      row.decision_note_encrypted,
      row.decision_note_iv,
    ),
  }));
}

export async function listRequestsForTeacher(
  teacherId: string,
): Promise<GradeAccessRequest[]> {
  const pool = getPool();
  const result = await pool.query<
    GradeAccessRequest & {
      reason_encrypted: string | null;
      reason_iv: string | null;
      decision_note_encrypted: string | null;
      decision_note_iv: string | null;
    }
  >(
    `SELECT id, teacher_id, school_id, exact_grade, reason_encrypted, reason_iv,
            status, requested_at, decided_at, decided_by,
            decision_note_encrypted, decision_note_iv
     FROM grade_access_requests
     WHERE teacher_id = $1
     ORDER BY requested_at DESC`,
    [teacherId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    teacher_id: row.teacher_id,
    school_id: row.school_id,
    exact_grade: row.exact_grade as ExactGrade | null,
    reason: decryptOptionalText(row.reason_encrypted, row.reason_iv),
    status: row.status,
    requested_at: row.requested_at,
    decided_at: row.decided_at,
    decided_by: row.decided_by,
    decision_note: decryptOptionalText(
      row.decision_note_encrypted,
      row.decision_note_iv,
    ),
  }));
}

export async function createAccessRequest(
  teacherId: string,
  input: {
    schoolId: string;
    exactGrade?: ExactGrade | null;
    reason?: string | null;
  },
): Promise<GradeAccessRequest> {
  const pool = getPool();
  let reasonEncrypted: string | null = null;
  let reasonIv: string | null = null;
  if (input.reason?.trim()) {
    const enc = encrypt(input.reason.trim());
    reasonEncrypted = enc.ciphertext;
    reasonIv = enc.iv;
  }

  const result = await pool.query<
    GradeAccessRequest & {
      reason_encrypted: string | null;
      reason_iv: string | null;
    }
  >(
    `INSERT INTO grade_access_requests (
       teacher_id, school_id, exact_grade, reason_encrypted, reason_iv
     ) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, teacher_id, school_id, exact_grade, reason_encrypted, reason_iv,
               status, requested_at, decided_at, decided_by,
               decision_note_encrypted, decision_note_iv`,
    [
      teacherId,
      input.schoolId,
      input.exactGrade ?? null,
      reasonEncrypted,
      reasonIv,
    ],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    teacher_id: row.teacher_id,
    school_id: row.school_id,
    exact_grade: row.exact_grade as ExactGrade | null,
    reason: decryptOptionalText(row.reason_encrypted, row.reason_iv),
    status: row.status,
    requested_at: row.requested_at,
    decided_at: row.decided_at,
    decided_by: row.decided_by,
    decision_note: null,
  };
}

export async function decideRequest(
  adminId: string,
  requestId: string,
  input: {
    decision: "approved" | "denied";
    expiresAt?: Date | null;
    decisionNote?: string | null;
  },
): Promise<{ request: GradeAccessRequest; grant?: GradeGrant } | null> {
  return withTransaction(async (client) => {
    const existing = await client.query<{
      id: string;
      teacher_id: string;
      school_id: string;
      exact_grade: string | null;
      status: string;
    }>(
      `SELECT id, teacher_id, school_id, exact_grade, status
       FROM grade_access_requests
       WHERE id = $1 FOR UPDATE`,
      [requestId],
    );
    const row = existing.rows[0];
    if (!row || row.status !== "pending") return null;

    let decisionNoteEncrypted: string | null = null;
    let decisionNoteIv: string | null = null;
    if (input.decisionNote?.trim()) {
      const enc = encrypt(input.decisionNote.trim());
      decisionNoteEncrypted = enc.ciphertext;
      decisionNoteIv = enc.iv;
    }

    const updated = await client.query<GradeAccessRequest>(
      `UPDATE grade_access_requests
       SET status = $2,
           decided_at = NOW(),
           decided_by = $3,
           decision_note_encrypted = $4,
           decision_note_iv = $5
       WHERE id = $1
       RETURNING id, teacher_id, school_id, exact_grade, status, requested_at,
                 decided_at, decided_by`,
      [
        requestId,
        input.decision,
        adminId,
        decisionNoteEncrypted,
        decisionNoteIv,
      ],
    );

    const request: GradeAccessRequest = {
      ...updated.rows[0],
      exact_grade: updated.rows[0].exact_grade as ExactGrade | null,
      reason: null,
      decision_note: input.decisionNote?.trim() ?? null,
    };

    if (input.decision === "denied") {
      return { request };
    }

    const grantResult = await client.query<GradeGrant>(
      `INSERT INTO grade_grants (
         teacher_id, school_id, exact_grade, granted_by, expires_at, origin, request_id
       ) VALUES ($1, $2, $3, $4, $5, 'request', $6)
       RETURNING id, teacher_id, school_id, exact_grade, granted_by, granted_at,
                 expires_at, revoked_at, revoked_by, origin, request_id, note`,
      [
        row.teacher_id,
        row.school_id,
        row.exact_grade,
        adminId,
        input.expiresAt ?? null,
        requestId,
      ],
    );

    return {
      request,
      grant: {
        ...grantResult.rows[0],
        exact_grade: grantResult.rows[0].exact_grade as ExactGrade | null,
      },
    };
  });
}

export async function teacherHasGrantForStudent(
  teacherId: string,
  studentUuid: string,
): Promise<{ grantId: string; grantScope: "grade" | "school" } | null> {
  const pool = getPool();
  const result = await pool.query<{
    grant_id: string;
    grant_scope: "grade" | "school";
  }>(
    `SELECT g.id AS grant_id,
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
    [teacherId, studentUuid],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { grantId: row.grant_id, grantScope: row.grant_scope };
}
