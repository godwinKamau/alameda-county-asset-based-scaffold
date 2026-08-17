import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { recordAudit } from "@/lib/audit/log";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { insertTeacherFeedback } from "@/lib/db/feedback";
import { listGrantsForTeacher } from "@/lib/db/grade-grants";
import { gradesSnapshotFromGrants } from "@/lib/feedback/grades";
import { CreateFeedbackSchema } from "@/lib/feedback/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = CreateFeedbackSchema.parse(await req.json());
    const grants = await listGrantsForTeacher(teacher.id);
    const gradesSnapshot = gradesSnapshotFromGrants(grants);
    const id = randomUUID();

    await insertTeacherFeedback({
      id,
      teacherId: teacher.id,
      schoolId: teacher.school_id,
      category: body.category,
      message: body.message,
      pageArea: body.page_area ?? null,
      gradesSnapshot,
    });

    await recordAudit({
      actorId: teacher.id,
      action: "feedback.create",
      resourceType: "feedback",
      resourceId: id,
      req,
    });

    return NextResponse.json({ feedback: { id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/feedback]", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 },
    );
  }
}

export const POST = withDbGuard(postHandler);
