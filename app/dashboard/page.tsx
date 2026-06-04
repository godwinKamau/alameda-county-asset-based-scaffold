import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { DashboardHeaderActions } from "@/components/DashboardHeaderActions";
import { DashboardShell } from "@/components/DashboardShell";
import {
  DashboardTabs,
  type DashboardRosterEntry,
} from "@/components/DashboardTabs";
import { StatCard } from "@/components/StatCard";
import { hashEmail } from "@/lib/audit/log";
import {
  findTeacherByEmailHash,
  listRosterEntriesWithStats,
} from "@/lib/db/queries";
import { collectExistingSubjects } from "@/lib/roster/subject";
import { computeDashboardStats } from "@/lib/roster/stats";

function serializeRosterEntries(
  roster: Awaited<ReturnType<typeof listRosterEntriesWithStats>>,
): DashboardRosterEntry[] {
  return roster.map((entry) => ({
    id: entry.id,
    student_uuid: entry.student_uuid,
    label: entry.label,
    subject: entry.subject,
    grade_span: entry.grade_span,
    exact_grade: entry.exact_grade,
    known_elpac_level: entry.known_elpac_level,
    session_count: entry.session_count,
    avg_level: entry.avg_level,
    last_session_at: entry.last_session_at
      ? entry.last_session_at.toISOString()
      : null,
  }));
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  const teacher = await findTeacherByEmailHash(hashEmail(email));
  const roster = teacher ? await listRosterEntriesWithStats(teacher.id) : [];
  const existingSubjects = collectExistingSubjects(
    roster.map((entry) => entry.subject),
  );
  const stats = computeDashboardStats(roster);
  const serializedEntries = serializeRosterEntries(roster);

  const subjectSublabel =
    stats.subjectCount === 1
      ? "across 1 subject"
      : `across ${stats.subjectCount} subjects`;

  return (
    <DashboardShell title="Dashboard" actions={<DashboardHeaderActions />}>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Students in roster"
            value={stats.totalStudents}
            sublabel={subjectSublabel}
            accent="brand"
            icon={
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 14l9-5-9-5-9 5 9 5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                />
              </svg>
            }
          />
          <StatCard
            label="Analyzed this month"
            value={stats.analyzedThisMonth}
            sublabel={stats.lastAnalysisSublabel}
            accent="green"
            icon={
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Never analyzed"
            value={stats.neverAnalyzed}
            sublabel="no artifact submitted yet"
            accent="orange"
            highlight
            icon={
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            }
          />
        </div>

        <Suspense fallback={null}>
          <DashboardTabs
            entries={serializedEntries}
            existingSubjects={existingSubjects}
          />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
