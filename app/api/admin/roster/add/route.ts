import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import { createRosterEntries } from "@/lib/db/queries";
import { resolveRosterGradeFields } from "@/lib/roster/grade";
import { ExactGradeSchema, GradeSpanSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AddStudentSchema = z.object({
  label: z.string().trim().min(1, "Student name is required"),
  subject: z.string().trim().max(80).optional(),
  grade_span: GradeSpanSchema.optional(),
  exact_grade: ExactGradeSchema,
  known_elpac_level: z.number().int().min(1).max(4).nullable().optional(),
});

async function postHandler(req: Request) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  try {
    const body = AddStudentSchema.parse(await req.json());
    const resolved = resolveRosterGradeFields({
      grade_span: body.grade_span,
      exact_grade: body.exact_grade,
    });

    const [created] = await createRosterEntries(
      admin.id,
      [
        {
          label: body.label,
          subject: body.subject ?? "",
          grade_span: resolved.grade_span,
          exact_grade: resolved.exact_grade ?? body.exact_grade,
          known_elpac_level: body.known_elpac_level ?? null,
        },
      ],
      admin.school_id,
    );

    await recordAudit({
      actorId: admin.id,
      action: "roster.add",
      resourceType: "roster",
      resourceId: created.student_uuid,
      req,
      authorizedByType: "admin_role",
    });

    return NextResponse.json({
      student_uuid: created.student_uuid,
      label: body.label,
      subject: body.subject ?? "",
      grade_span: resolved.grade_span,
      exact_grade: resolved.exact_grade ?? body.exact_grade,
      known_elpac_level: body.known_elpac_level ?? null,
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
    console.error("[api/admin/roster/add]", error);
    return NextResponse.json(
      { error: "Failed to add student" },
      { status: 400 },
    );
  }
}

export const POST = withDbGuard(postHandler);
