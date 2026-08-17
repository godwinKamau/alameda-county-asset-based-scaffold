import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DbWakingBanner } from "@/components/DbWakingBanner";
import { StudentsPageClient } from "@/components/StudentsPageClient";
import { hashEmail } from "@/lib/audit/log";
import { isDatabaseWakingError } from "@/lib/db/errors";
import {
  findTeacherByEmailHash,
  listDomainLevelsForTeacherStudents,
  listLatestAnalysisForAccessibleStudents,
  listRosterEntriesWithStats,
} from "@/lib/db/queries";
import {
  listGroupsWithMembers,
  listHiddenStudentUuids,
} from "@/lib/db/teacher-groups";
import { emptyDomainLevels, ELPAC_DOMAINS, type ElpacDomain } from "@/lib/elpac/domain";

export default async function StudentsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  let teacher: Awaited<ReturnType<typeof findTeacherByEmailHash>>;
  let roster: Awaited<ReturnType<typeof listRosterEntriesWithStats>>;
  let groups: Awaited<ReturnType<typeof listGroupsWithMembers>> = [];
  let hidden: string[] = [];
  let domainRows: Awaited<
    ReturnType<typeof listDomainLevelsForTeacherStudents>
  > = [];
  let latestAnalyses: Awaited<
    ReturnType<typeof listLatestAnalysisForAccessibleStudents>
  > = [];

  try {
    teacher = await findTeacherByEmailHash(hashEmail(email));
    if (teacher) {
      [roster, groups, hidden, domainRows, latestAnalyses] = await Promise.all([
        listRosterEntriesWithStats(teacher.id),
        listGroupsWithMembers(teacher.id),
        listHiddenStudentUuids(teacher.id),
        listDomainLevelsForTeacherStudents(teacher.id),
        listLatestAnalysisForAccessibleStudents(teacher.id),
      ]);
    } else {
      roster = [];
    }
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

  const domainLevelsByStudent = new Map<
    string,
    Record<ElpacDomain, number | null>
  >();

  for (const row of domainRows) {
    let levels = domainLevelsByStudent.get(row.student_uuid);
    if (!levels) {
      levels = emptyDomainLevels();
      domainLevelsByStudent.set(row.student_uuid, levels);
    }
    if (ELPAC_DOMAINS.includes(row.domain as ElpacDomain)) {
      levels[row.domain as ElpacDomain] =
        Math.round(row.avg_level * 10) / 10;
    }
  }

  const latestAnalysisByStudent = new Map(
    latestAnalyses.map((row) => [
      row.student_uuid,
      {
        domain: row.domain,
        estimated_level: row.estimated_level,
        submitted_at: row.submitted_at.toISOString(),
      },
    ]),
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
    domain_levels:
      domainLevelsByStudent.get(entry.student_uuid) ?? emptyDomainLevels(),
    latest_analysis:
      latestAnalysisByStudent.get(entry.student_uuid) ?? null,
  }));

  return (
    <DashboardShell title="Students">
      <div className="mx-auto max-w-6xl space-y-6">
        <p className="text-sm text-muted">
          Browse shows students in your private groups. Use Organize to create
          groups, move students, or hide them from your list.
        </p>
        <StudentsPageClient
          entries={entries}
          initialGroups={groups}
          initialHidden={hidden}
        />
      </div>
    </DashboardShell>
  );
}
