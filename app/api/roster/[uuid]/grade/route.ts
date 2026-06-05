import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import {
  rosterEntryBelongsToTeacher,
  updateRosterEntryGrade,
} from "@/lib/db/queries";
import { resolveRosterGradeFields } from "@/lib/roster/grade";
import { ExactGradeSchema, GradeSpanSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateGradeSchema = z.object({
  grade_span: GradeSpanSchema.optional(),
  exact_grade: ExactGradeSchema.nullable().optional(),
});

async function patchHandler(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const { uuid } = await params;

  try {
    const body = UpdateGradeSchema.parse(await req.json());

    const belongs = await rosterEntryBelongsToTeacher(teacher.id, uuid);
    if (!belongs) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const resolved = resolveRosterGradeFields({
      grade_span: body.grade_span,
      exact_grade: body.exact_grade ?? "",
    });

    const updated = await updateRosterEntryGrade(
      teacher.id,
      uuid,
      resolved.grade_span,
      resolved.exact_grade,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update grade" },
        { status: 400 },
      );
    }

    await recordAudit({
      actorId: teacher.id,
      action: "roster.update_grade",
      resourceType: "roster",
      resourceId: uuid,
      req,
    });

    return NextResponse.json({
      grade_span: resolved.grade_span,
      exact_grade: resolved.exact_grade,
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
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/roster/[uuid]/grade]", error);
    return NextResponse.json(
      { error: "Failed to update grade" },
      { status: 400 },
    );
  }
}

export const PATCH = withDbGuard(patchHandler);
