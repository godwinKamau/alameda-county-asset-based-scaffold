import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import {
  isStudentAccessResponse,
  requireStudentAccess,
} from "@/lib/auth/student-access";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import {
  hideStudent,
  listHiddenStudentUuids,
  unhideStudent,
} from "@/lib/db/teacher-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HiddenSchema = z.object({
  student_uuid: z.string().uuid(),
});

async function getHandler() {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const hidden = await listHiddenStudentUuids(teacher.id);
  return NextResponse.json({ hidden });
}

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = HiddenSchema.parse(await req.json());
    const access = await requireStudentAccess(teacher, body.student_uuid);
    if (isStudentAccessResponse(access)) return access;

    await hideStudent(teacher.id, body.student_uuid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to hide student" }, { status: 500 });
  }
}

async function deleteHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = HiddenSchema.parse(await req.json());
    const access = await requireStudentAccess(teacher, body.student_uuid);
    if (isStudentAccessResponse(access)) return access;

    await unhideStudent(teacher.id, body.student_uuid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to unhide student" }, { status: 500 });
  }
}

export const GET = withDbGuard(getHandler);
export const POST = withDbGuard(postHandler);
export const DELETE = withDbGuard(deleteHandler);
