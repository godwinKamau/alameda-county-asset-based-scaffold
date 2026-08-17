import "server-only";

import { getPool } from "./pool";
import type { TeacherRole } from "@/lib/types";

export async function listTeachersForSchool(
  schoolId: string,
): Promise<{ id: string; role: string; email_hash: string }[]> {
  const pool = getPool();
  const result = await pool.query<{ id: string; role: string; email_hash: string }>(
    `SELECT id, role, email_hash FROM teacher_accounts WHERE school_id = $1 ORDER BY created_at ASC`,
    [schoolId],
  );
  return result.rows;
}

export async function listSchools(): Promise<{ id: string; name: string }[]> {
  const pool = getPool();
  const result = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM schools ORDER BY name ASC`,
  );
  return result.rows;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  occurred_at: Date;
  authorized_by: string | null;
  authorized_by_type: string | null;
}

export async function listAuditLog(
  schoolId: string,
  options?: { limit?: number; offset?: number },
): Promise<AuditLogRow[]> {
  const pool = getPool();
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const result = await pool.query<AuditLogRow>(
    `SELECT al.id, al.actor_id, al.action, al.resource_type, al.resource_id,
            al.occurred_at, al.authorized_by, al.authorized_by_type
     FROM audit_log al
     JOIN teacher_accounts ta ON ta.id = al.actor_id
     WHERE ta.school_id = $1
     ORDER BY al.occurred_at DESC
     LIMIT $2 OFFSET $3`,
    [schoolId, limit, offset],
  );
  return result.rows;
}

export async function countAdminsAtSchool(schoolId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM teacher_accounts
     WHERE school_id = $1 AND role IN ('admin', 'eld_coordinator')`,
    [schoolId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function setTeacherRole(
  adminId: string,
  schoolId: string,
  teacherId: string,
  role: TeacherRole,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (adminId === teacherId) {
    return { ok: false, reason: "You cannot change your own role" };
  }

  const pool = getPool();
  const target = await pool.query<{ role: TeacherRole; school_id: string }>(
    `SELECT role, school_id FROM teacher_accounts WHERE id = $1`,
    [teacherId],
  );
  const row = target.rows[0];
  if (!row || row.school_id !== schoolId) {
    return { ok: false, reason: "Teacher not found" };
  }

  const isCurrentlyAdmin =
    row.role === "admin" || row.role === "eld_coordinator";
  const willBeAdmin = role === "admin" || role === "eld_coordinator";

  if (isCurrentlyAdmin && !willBeAdmin) {
    const adminCount = await countAdminsAtSchool(schoolId);
    if (adminCount <= 1) {
      return { ok: false, reason: "Cannot demote the last administrator" };
    }
  }

  await pool.query(`UPDATE teacher_accounts SET role = $2 WHERE id = $1`, [
    teacherId,
    role,
  ]);

  return { ok: true };
}
