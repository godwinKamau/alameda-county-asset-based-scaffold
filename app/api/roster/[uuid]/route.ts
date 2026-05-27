import { NextResponse } from "next/server";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { deleteRosterEntry } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const { uuid } = await context.params;

  try {
    const removed = await deleteRosterEntry(teacher.id, uuid);
    if (!removed) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    await recordAudit({
      actorId: teacher.id,
      action: "roster.delete",
      resourceType: "roster",
      resourceId: uuid,
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/roster/[uuid]]", error);
    return NextResponse.json(
      { error: "Failed to delete student" },
      { status: 500 },
    );
  }
}
