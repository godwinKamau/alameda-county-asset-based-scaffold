import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { listRosterEntries } from "@/lib/db/queries";
import { listHiddenStudentUuids } from "@/lib/db/teacher-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const url = new URL(req.url);
  const includeHidden = url.searchParams.get("include_hidden") === "1";

  const [entries, hidden] = await Promise.all([
    listRosterEntries(teacher.id),
    includeHidden ? Promise.resolve([]) : listHiddenStudentUuids(teacher.id),
  ]);

  const hiddenSet = new Set(hidden);
  const filtered = includeHidden
    ? entries
    : entries.filter((entry) => !hiddenSet.has(entry.student_uuid));

  return NextResponse.json({
    entries: filtered.map((entry) => ({
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
