import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AddStudentForm } from "@/components/AddStudentForm";
import { DashboardShell } from "@/components/DashboardShell";
import { RosterList } from "@/components/RosterList";
import { StatCard } from "@/components/StatCard";
import {
  findTeacherByEmailHash,
  listRosterEntries,
} from "@/lib/db/queries";
import { hashEmail } from "@/lib/audit/log";
import { collectExistingSubjects } from "@/lib/roster/subject";
import { btnDashboardActionClassName } from "@/lib/ui/styles";
import { currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  const teacher = await findTeacherByEmailHash(hashEmail(email));
  const roster = teacher ? await listRosterEntries(teacher.id) : [];
  const existingSubjects = collectExistingSubjects(
    roster.map((entry) => entry.subject),
  );

  return (
    <DashboardShell title="Dashboard">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xs flex-1">
            <StatCard
              label="Students in roster"
              value={roster.length}
              accent="brand"
              href="/students"
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
          </div>
          <Link
            href="/analyze"
            className={`${btnDashboardActionClassName} text-center`}
          >
            New Analysis
          </Link>
        </div>

        <AddStudentForm existingSubjects={existingSubjects} />

        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold text-brand-dark">Your Roster</h2>
          <RosterList entries={roster} existingSubjects={existingSubjects} />
        </section>
      </div>
    </DashboardShell>
  );
}
