import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { listSessionsForStudent, rosterEntryBelongsToTeacher } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

async function getHandler(req: Request, context: RouteContext) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const { uuid } = await context.params;

  const ownsStudent = await rosterEntryBelongsToTeacher(teacher.id, uuid);
  if (!ownsStudent) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const sessions = await listSessionsForStudent(teacher.id, uuid);

  await recordAudit({
    actorId: teacher.id,
    action: "analysis.read",
    resourceType: "student",
    resourceId: uuid,
    req,
  });

  return NextResponse.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      student_uuid: session.student_uuid,
      domain: session.domain,
      grade_span: session.grade_span,
      provided_elpac_level: session.provided_elpac_level,
      submitted_at: session.submitted_at,
      insight: session.insight,
    })),
  });
}

export const GET = withDbGuard(getHandler);
