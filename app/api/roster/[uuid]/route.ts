import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import { deleteRosterEntry } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

async function deleteHandler(req: Request, context: RouteContext) {
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
    if (isDatabaseWakingError(error)) {
      return databaseWakingResponse();
    }
    console.error("[api/roster/[uuid]]", error);
    return NextResponse.json(
      { error: "Failed to delete student" },
      { status: 500 },
    );
  }
}

export const DELETE = withDbGuard(deleteHandler);
