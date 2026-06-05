import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { listRosterEntries } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getHandler(_req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const entries = await listRosterEntries(teacher.id);

  return NextResponse.json({
    entries: entries.map((entry) => ({
      student_uuid: entry.student_uuid,
      label: entry.label,
      subject: entry.subject,
      grade_span: entry.grade_span,
      exact_grade: entry.exact_grade,
      known_elpac_level: entry.known_elpac_level,
    })),
  });
}

export const GET = withDbGuard(getHandler);
