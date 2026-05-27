import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AddStudentForm } from "@/components/AddStudentForm";
import { RosterList } from "@/components/RosterList";
import { RosterUploader } from "@/components/RosterUploader";
import {
  findTeacherByEmailHash,
  listRosterEntries,
} from "@/lib/db/queries";
import { hashEmail } from "@/lib/audit/log";
import { collectExistingSubjects } from "@/lib/roster/subject";
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
    <>
      <AppHeader title="Dashboard" />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {roster.length} student{roster.length === 1 ? "" : "s"} in roster
          </p>
          <Link
            href="/analyze"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Analysis
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AddStudentForm existingSubjects={existingSubjects} />
          <RosterUploader />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Your Roster</h2>
          <RosterList entries={roster} existingSubjects={existingSubjects} />
        </section>
      </main>
    </>
  );
}
