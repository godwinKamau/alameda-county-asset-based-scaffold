import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { createAccessRequest, listRequestsForTeacher } from "@/lib/db/grade-grants";
import { ExactGradeSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateRequestSchema = z.object({
  exact_grade: ExactGradeSchema.nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

async function getHandler() {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const requests = await listRequestsForTeacher(teacher.id);
  return NextResponse.json({ requests });
}

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = CreateRequestSchema.parse(await req.json());
    const request = await createAccessRequest(teacher.id, {
      schoolId: teacher.school_id,
      exactGrade: body.exact_grade ?? null,
      reason: body.reason ?? null,
    });

    await recordAudit({
      actorId: teacher.id,
      action: "access_request.create",
      resourceType: "access_request",
      resourceId: request.id,
      req,
    });

    return NextResponse.json({ request });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/access-requests]", error);
    return NextResponse.json(
      { error: "Failed to submit access request" },
      { status: 500 },
    );
  }
}

export const GET = withDbGuard(getHandler);
export const POST = withDbGuard(postHandler);
