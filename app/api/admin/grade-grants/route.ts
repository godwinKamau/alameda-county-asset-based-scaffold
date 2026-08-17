import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { attachTeacherNames } from "@/lib/auth/teacher-names";
import {
  createGrant,
  listActiveGrantsForSchool,
} from "@/lib/db/grade-grants";
import { listSchools, listTeachersForSchool } from "@/lib/db/admin";
import { ExactGradeSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateGrantSchema = z.object({
  teacher_id: z.string().uuid(),
  school_id: z.string().uuid(),
  exact_grade: ExactGradeSchema.nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

async function getHandler(req: Request) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get("school_id") ?? admin.school_id;

  if (schoolId !== admin.school_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [grants, schools, teacherRows] = await Promise.all([
    listActiveGrantsForSchool(schoolId),
    listSchools(),
    listTeachersForSchool(schoolId),
  ]);
  const teachers = await attachTeacherNames(teacherRows);
  const namesById = new Map(teachers.map((t) => [t.id, t.name]));

  return NextResponse.json({
    grants: grants.map((grant) => ({
      ...grant,
      teacher_name: namesById.get(grant.teacher_id) ?? null,
    })),
    schools,
    teachers,
    current_teacher_id: admin.id,
  });
}

async function postHandler(req: Request) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  try {
    const body = CreateGrantSchema.parse(await req.json());

    if (body.school_id !== admin.school_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const grant = await createGrant(admin.id, {
      teacherId: body.teacher_id,
      schoolId: body.school_id,
      exactGrade: body.exact_grade ?? null,
      expiresAt: body.expires_at ? new Date(body.expires_at) : null,
      note: body.note ?? null,
    });

    await recordAudit({
      actorId: admin.id,
      action: "grade_grant.create",
      resourceType: "grade_grant",
      resourceId: grant.id,
      req,
    });

    return NextResponse.json({ grant });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/admin/grade-grants]", error);
    return NextResponse.json(
      { error: "Failed to create grade grant" },
      { status: 500 },
    );
  }
}

export const GET = withDbGuard(getHandler);
export const POST = withDbGuard(postHandler);
