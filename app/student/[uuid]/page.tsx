import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { InsightCard } from "@/components/InsightCard";
import { recordAudit } from "@/lib/audit/log";
import { hashEmail } from "@/lib/audit/log";
import {
  findTeacherByEmailHash,
  listSessionsForStudent,
  rosterEntryBelongsToTeacher,
} from "@/lib/db/queries";
import { headers } from "next/headers";
import { btnPrimaryClassName, cardClassName } from "@/lib/ui/styles";

interface StudentPageProps {
  params: Promise<{ uuid: string }>;
}

export default async function StudentPage({ params }: StudentPageProps) {
  const { uuid } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  const teacher = await findTeacherByEmailHash(hashEmail(email));
  if (!teacher) redirect("/dashboard");

  const ownsStudent = await rosterEntryBelongsToTeacher(teacher.id, uuid);
  if (!ownsStudent) redirect("/dashboard");

  const sessions = await listSessionsForStudent(teacher.id, uuid);

  const headerList = await headers();
  const req = new Request("http://localhost", {
    headers: headerList,
  });

  await recordAudit({
    actorId: teacher.id,
    action: "analysis.read",
    resourceType: "student",
    resourceId: uuid,
    req,
  });

  return (
    <DashboardShell title="Student History">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-sm text-muted">{uuid}</p>
          <Link href="/analyze" className={btnPrimaryClassName}>
            New analysis
          </Link>
        </div>

        {sessions.length === 0 ? (
          <p className={`${cardClassName} text-sm text-muted`}>
            No analysis sessions yet for this student.
          </p>
        ) : (
          sessions.map((session) => (
            <article
              key={session.id}
              className={`${cardClassName} space-y-4 bg-brand-soft/20`}
            >
              <header className="flex flex-wrap items-center gap-4 text-sm text-muted">
                <time dateTime={session.submitted_at.toISOString()}>
                  {new Date(session.submitted_at).toLocaleString()}
                </time>
                <span>Domain: {session.domain}</span>
                <span>Grade span: {session.grade_span}</span>
                {session.provided_elpac_level != null && (
                  <span>Provided level: {session.provided_elpac_level}</span>
                )}
              </header>
              <InsightCard insight={session.insight} />
            </article>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
