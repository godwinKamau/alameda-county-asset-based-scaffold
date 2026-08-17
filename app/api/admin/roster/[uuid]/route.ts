import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  countOtherTeachersSessionsForStudent,
  deleteRosterEntryBySchool,
  rosterEntryInSchool,
} from "@/lib/db/queries";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DeleteSchema = z.object({
  confirm_destroys_analyses: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

async function deleteHandler(req: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const { uuid } = await context.params;

  try {
    const inSchool = await rosterEntryInSchool(admin.school_id, uuid);
    if (!inSchool) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const body = DeleteSchema.parse(
      req.headers.get("content-type")?.includes("application/json")
        ? await req.json()
        : {},
    );

    const otherSessions = await countOtherTeachersSessionsForStudent(
      admin.school_id,
      uuid,
      admin.id,
    );

    if (otherSessions > 0 && !body.confirm_destroys_analyses) {
      return NextResponse.json(
        {
          error:
            "This student has analyses from other teachers. Confirm deletion to remove all analyses.",
          other_teacher_sessions: otherSessions,
          requires_confirmation: true,
        },
        { status: 409 },
      );
    }

    const removed = await deleteRosterEntryBySchool(admin.school_id, uuid);
    if (!removed) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    await recordAudit({
      actorId: admin.id,
      action:
        otherSessions > 0
          ? "roster.admin.delete_with_analyses"
          : "roster.delete",
      resourceType: "roster",
      resourceId: uuid,
      req,
      authorizedByType: "admin_role",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseWakingError(error)) {
      return databaseWakingResponse();
    }
    console.error("[api/admin/roster/[uuid]]", error);
    return NextResponse.json(
      { error: "Failed to delete student" },
      { status: 500 },
    );
  }
}

export const DELETE = withDbGuard(deleteHandler);
