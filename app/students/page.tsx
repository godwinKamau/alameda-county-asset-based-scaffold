import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DbWakingBanner } from "@/components/DbWakingBanner";
import { StudentsExplorer } from "@/components/StudentsExplorer";
import {
  findTeacherByEmailHash,
  listRosterEntriesWithStats,
} from "@/lib/db/queries";
import { hashEmail } from "@/lib/audit/log";
import { isDatabaseWakingError } from "@/lib/db/errors";
import { collectExistingSubjects } from "@/lib/roster/subject";

export default async function StudentsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  let teacher: Awaited<ReturnType<typeof findTeacherByEmailHash>>;
  let roster: Awaited<ReturnType<typeof listRosterEntriesWithStats>>;
  try {
    teacher = await findTeacherByEmailHash(hashEmail(email));
    roster = teacher ? await listRosterEntriesWithStats(teacher.id) : [];
  } catch (err) {
    if (isDatabaseWakingError(err)) {
      return (
        <DashboardShell title="Students">
          <DbWakingBanner />
        </DashboardShell>
      );
    }
    throw err;
  }

  const existingSubjects = collectExistingSubjects(
    roster.map((entry) => entry.subject),
  );

  const entries = roster.map((entry) => ({
    id: entry.id,
    student_uuid: entry.student_uuid,
    label: entry.label,
    subject: entry.subject,
    grade_span: entry.grade_span,
    exact_grade: entry.exact_grade,
    known_elpac_level: entry.known_elpac_level,
    session_count: entry.session_count,
    avg_level: entry.avg_level,
    last_session_at: entry.last_session_at?.toISOString() ?? null,
  }));

  return (
    <DashboardShell title="Students">
      <div className="mx-auto max-w-6xl space-y-6">
        <p className="text-sm text-muted">
          Browse and filter your roster. Students are grouped by subject by
          default.
        </p>
        <section className="ui-card p-6">
          <StudentsExplorer
            entries={entries}
            existingSubjects={existingSubjects}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
