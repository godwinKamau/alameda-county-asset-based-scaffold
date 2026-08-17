import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  listStudentsMissingGrade,
  setStudentGrade,
} from "@/lib/db/queries";
import { deriveGradeSpan, ExactGradeSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SetGradeSchema = z.object({
  student_uuid: z.string().uuid(),
  exact_grade: ExactGradeSchema,
});

async function getHandler() {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const students = await listStudentsMissingGrade(admin.school_id);
  return NextResponse.json({ students });
}

async function patchHandler(req: Request) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  try {
    const body = SetGradeSchema.parse(await req.json());
    const gradeSpan = deriveGradeSpan(body.exact_grade);
    const updated = await setStudentGrade(
      admin.school_id,
      body.student_uuid,
      body.exact_grade,
      gradeSpan,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Student not found or grade already set" },
        { status: 404 },
      );
    }

    await recordAudit({
      actorId: admin.id,
      action: "roster.admin.set_grade",
      resourceType: "roster",
      resourceId: body.student_uuid,
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/admin/roster/missing-grade]", error);
    return NextResponse.json(
      { error: "Failed to set student grade" },
      { status: 500 },
    );
  }
}

export const GET = withDbGuard(getHandler);
export const PATCH = withDbGuard(patchHandler);
