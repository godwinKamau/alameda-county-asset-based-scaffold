import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import {
  isStudentAccessResponse,
  requireStudentAccess,
} from "@/lib/auth/student-access";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { moveStudentToGroup } from "@/lib/db/teacher-groups";
import { getPool } from "@/lib/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MoveSchema = z.object({
  student_uuid: z.string().uuid(),
  group_id: z.string().uuid().nullable(),
  position: z.number().int().min(0).default(0),
});

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = MoveSchema.parse(await req.json());
    const access = await requireStudentAccess(teacher, body.student_uuid);
    if (isStudentAccessResponse(access)) return access;

    if (body.group_id) {
      const pool = getPool();
      const group = await pool.query(
        `SELECT 1 FROM teacher_student_groups WHERE id = $1 AND teacher_id = $2`,
        [body.group_id, teacher.id],
      );
      if ((group.rowCount ?? 0) === 0) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
    }

    await moveStudentToGroup(
      teacher.id,
      body.student_uuid,
      body.group_id,
      body.position,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to move student" }, { status: 500 });
  }
}

export const POST = withDbGuard(postHandler);
