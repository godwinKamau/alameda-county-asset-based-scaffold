import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { attachTeacherNames } from "@/lib/auth/teacher-names";
import { listPendingRequests } from "@/lib/db/grade-grants";
import { listTeachersForSchool } from "@/lib/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler() {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const [requests, teacherRows] = await Promise.all([
    listPendingRequests(admin.school_id),
    listTeachersForSchool(admin.school_id),
  ]);
  const teachers = await attachTeacherNames(teacherRows);
  const namesById = new Map(teachers.map((t) => [t.id, t.name]));

  return NextResponse.json({
    requests: requests.map((request) => ({
      ...request,
      teacher_name: namesById.get(request.teacher_id) ?? null,
    })),
  });
}

export const GET = withDbGuard(getHandler);
