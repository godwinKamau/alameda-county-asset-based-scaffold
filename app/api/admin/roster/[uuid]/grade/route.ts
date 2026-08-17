import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import {
  rosterEntryInSchool,
  updateRosterEntryGradeBySchool,
} from "@/lib/db/queries";
import { ExactGradeSchema, GradeSpanSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateGradeSchema = z.object({
  grade_span: GradeSpanSchema,
  exact_grade: ExactGradeSchema,
});

async function patchHandler(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const { uuid } = await params;

  try {
    const body = UpdateGradeSchema.parse(await req.json());

    const inSchool = await rosterEntryInSchool(admin.school_id, uuid);
    if (!inSchool) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const updated = await updateRosterEntryGradeBySchool(
      admin.school_id,
      uuid,
      body.grade_span,
      body.exact_grade,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update grade" },
        { status: 400 },
      );
    }

    await recordAudit({
      actorId: admin.id,
      action: "roster.update_grade",
      resourceType: "roster",
      resourceId: uuid,
      req,
      authorizedByType: "admin_role",
    });

    return NextResponse.json({
      grade_span: body.grade_span,
      exact_grade: body.exact_grade,
    });
  } catch (error) {
    if (isDatabaseWakingError(error)) {
      return databaseWakingResponse();
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/admin/roster/[uuid]/grade]", error);
    return NextResponse.json(
      { error: "Failed to update grade" },
      { status: 400 },
    );
  }
}

export const PATCH = withDbGuard(patchHandler);
