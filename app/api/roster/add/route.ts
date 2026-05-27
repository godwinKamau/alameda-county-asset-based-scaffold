import { NextResponse } from "next/server";
import { z } from "zod";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { createRosterEntries } from "@/lib/db/queries";
import { GradeSpanSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AddStudentSchema = z.object({
  label: z.string().trim().min(1, "Student name is required"),
  subject: z.string().trim().max(80).optional(),
  grade_span: GradeSpanSchema,
  known_elpac_level: z.number().int().min(1).max(4).nullable().optional(),
});

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = AddStudentSchema.parse(await req.json());
    const [created] = await createRosterEntries(teacher.id, [
      {
        label: body.label,
        subject: body.subject ?? "",
        grade_span: body.grade_span,
        known_elpac_level: body.known_elpac_level ?? null,
      },
    ]);

    await recordAudit({
      actorId: teacher.id,
      action: "roster.add",
      resourceType: "roster",
      resourceId: created.student_uuid,
      req,
    });

    return NextResponse.json({
      student_uuid: created.student_uuid,
      label: body.label,
      subject: body.subject ?? "",
      grade_span: body.grade_span,
      known_elpac_level: body.known_elpac_level ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/roster/add]", error);
    return NextResponse.json(
      { error: "Failed to add student" },
      { status: 400 },
    );
  }
}
