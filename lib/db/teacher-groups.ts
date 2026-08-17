import "server-only";

import { getPool, withTransaction } from "./pool";
import { decrypt, encrypt } from "@/lib/encryption/aes";

export interface TeacherGroupWithMembers {
  id: string;
  name: string;
  position: number;
  members: { student_uuid: string; position: number }[];
}

export async function listGroupsWithMembers(
  teacherId: string,
): Promise<TeacherGroupWithMembers[]> {
  const pool = getPool();
  const groups = await pool.query<{
    id: string;
    name_encrypted: string;
    name_iv: string;
    position: number;
  }>(
    `SELECT id, name_encrypted, name_iv, position
     FROM teacher_student_groups
     WHERE teacher_id = $1
     ORDER BY position ASC, created_at ASC`,
    [teacherId],
  );

  const members = await pool.query<{
    group_id: string;
    student_uuid: string;
    position: number;
  }>(
    `SELECT group_id, student_uuid, position
     FROM teacher_student_group_members
     WHERE teacher_id = $1
     ORDER BY position ASC`,
    [teacherId],
  );

  const membersByGroup = new Map<string, { student_uuid: string; position: number }[]>();
  for (const member of members.rows) {
    const list = membersByGroup.get(member.group_id) ?? [];
    list.push({ student_uuid: member.student_uuid, position: member.position });
    membersByGroup.set(member.group_id, list);
  }

  return groups.rows.map((group) => ({
    id: group.id,
    name: decrypt({ ciphertext: group.name_encrypted, iv: group.name_iv }),
    position: group.position,
    members: membersByGroup.get(group.id) ?? [],
  }));
}

export async function createGroup(
  teacherId: string,
  name: string,
): Promise<TeacherGroupWithMembers> {
  const pool = getPool();
  const enc = encrypt(name.trim());
  const positionResult = await pool.query<{ next: number }>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next
     FROM teacher_student_groups WHERE teacher_id = $1`,
    [teacherId],
  );
  const position = positionResult.rows[0]?.next ?? 0;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO teacher_student_groups (teacher_id, name_encrypted, name_iv, position)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [teacherId, enc.ciphertext, enc.iv, position],
  );

  return {
    id: result.rows[0].id,
    name: name.trim(),
    position,
    members: [],
  };
}

export async function renameGroup(
  teacherId: string,
  groupId: string,
  name: string,
): Promise<boolean> {
  const pool = getPool();
  const enc = encrypt(name.trim());
  const result = await pool.query(
    `UPDATE teacher_student_groups
     SET name_encrypted = $3, name_iv = $4, updated_at = NOW()
     WHERE id = $2 AND teacher_id = $1`,
    [teacherId, groupId, enc.ciphertext, enc.iv],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteGroup(
  teacherId: string,
  groupId: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM teacher_student_groups WHERE id = $2 AND teacher_id = $1`,
    [teacherId, groupId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function moveStudentToGroup(
  teacherId: string,
  studentUuid: string,
  groupId: string | null,
  position: number,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM teacher_student_group_members
       WHERE teacher_id = $1 AND student_uuid = $2`,
      [teacherId, studentUuid],
    );

    if (groupId) {
      await client.query(
        `INSERT INTO teacher_student_group_members (group_id, teacher_id, student_uuid, position)
         VALUES ($1, $2, $3, $4)`,
        [groupId, teacherId, studentUuid, position],
      );
    }
  });
}

export async function reorderGroupMembers(
  teacherId: string,
  groupId: string,
  studentUuids: string[],
): Promise<boolean> {
  return withTransaction(async (client) => {
    for (let i = 0; i < studentUuids.length; i++) {
      const result = await client.query(
        `UPDATE teacher_student_group_members
         SET position = $4
         WHERE teacher_id = $1 AND group_id = $2 AND student_uuid = $3`,
        [teacherId, groupId, studentUuids[i], i],
      );
      if ((result.rowCount ?? 0) === 0) return false;
    }
    return true;
  });
}

export async function reorderGroups(
  teacherId: string,
  groupIds: string[],
): Promise<void> {
  await withTransaction(async (client) => {
    for (let i = 0; i < groupIds.length; i++) {
      await client.query(
        `UPDATE teacher_student_groups SET position = $3, updated_at = NOW()
         WHERE teacher_id = $1 AND id = $2`,
        [teacherId, groupIds[i], i],
      );
    }
  });
}

export async function listHiddenStudentUuids(
  teacherId: string,
): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ student_uuid: string }>(
    `SELECT student_uuid FROM teacher_hidden_students WHERE teacher_id = $1`,
    [teacherId],
  );
  return result.rows.map((row) => row.student_uuid);
}

export async function hideStudent(
  teacherId: string,
  studentUuid: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO teacher_hidden_students (teacher_id, student_uuid)
     VALUES ($1, $2)
     ON CONFLICT (teacher_id, student_uuid) DO NOTHING`,
    [teacherId, studentUuid],
  );
}

export async function unhideStudent(
  teacherId: string,
  studentUuid: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM teacher_hidden_students
     WHERE teacher_id = $1 AND student_uuid = $2`,
    [teacherId, studentUuid],
  );
  return (result.rowCount ?? 0) > 0;
}
