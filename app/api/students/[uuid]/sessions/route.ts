import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import {
  isStudentAccessResponse,
  requireStudentAccess,
} from "@/lib/auth/student-access";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { listSessionsForStudent } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

async function getHandler(req: Request, context: RouteContext) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const { uuid } = await context.params;

  const access = await requireStudentAccess(teacher, uuid);
  if (isStudentAccessResponse(access)) return access;

  const sessions = await listSessionsForStudent(uuid);

  await recordAudit({
    actorId: teacher.id,
    action: "analysis.read",
    resourceType: "student",
    resourceId: uuid,
    req,
    authorizedBy: access.grantId,
    authorizedByType: "grade_grant",
  });

  return NextResponse.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      student_uuid: session.student_uuid,
      domain: session.domain,
      grade_span: session.grade_span,
      provided_elpac_level: session.provided_elpac_level,
      submitted_at: session.submitted_at,
      teacher_id: session.teacher_id,
      insight: session.insight,
    })),
  });
}

export const GET = withDbGuard(getHandler);
