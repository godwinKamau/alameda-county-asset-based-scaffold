import { NextResponse } from "next/server";
import { z } from "zod";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  rosterEntryBelongsToTeacher,
  updateRosterEntrySubject,
} from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateSubjectSchema = z.object({
  subject: z.string().trim().max(80),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const { uuid } = await params;

  try {
    const body = UpdateSubjectSchema.parse(await req.json());

    const belongs = await rosterEntryBelongsToTeacher(teacher.id, uuid);
    if (!belongs) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const updated = await updateRosterEntrySubject(
      teacher.id,
      uuid,
      body.subject,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update subject" },
        { status: 400 },
      );
    }

    await recordAudit({
      actorId: teacher.id,
      action: "roster.update_subject",
      resourceType: "roster",
      resourceId: uuid,
      req,
    });

    return NextResponse.json({ subject: body.subject });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/roster/[uuid]/subject]", error);
    return NextResponse.json(
      { error: "Failed to update subject" },
      { status: 400 },
    );
  }
}
