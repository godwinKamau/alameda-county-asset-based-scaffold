import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { AnalysisSessionArticle } from "@/components/AnalysisSessionArticle";
import {
  CompositeLevelCard,
  StudentLevelChart,
  computeCompositeLevels,
  computeDomainLevels,
} from "@/components/StudentLevelChart";
import { StudentNameHeading } from "@/components/StudentNameHeading";
import { recordAudit } from "@/lib/audit/log";
import { hashEmail } from "@/lib/audit/log";
import {
  findTeacherByEmailHash,
  getRosterEntryLabel,
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

  const [sessions, label] = await Promise.all([
    listSessionsForStudent(teacher.id, uuid),
    getRosterEntryLabel(teacher.id, uuid),
  ]);

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

  const sessionLevels = sessions.map((session) => ({
    domain: session.domain,
    estimated_level: session.insight.estimated_level,
  }));

  const compositeLevels = computeCompositeLevels(sessionLevels);
  const domainLevels = computeDomainLevels(sessionLevels);

  return (
    <DashboardShell title="Student History">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <StudentNameHeading label={label} studentUuid={uuid} />
          <Link href="/analyze" className={btnPrimaryClassName}>
            New analysis
          </Link>
        </div>

        {sessions.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {compositeLevels.map((composite) => (
                <CompositeLevelCard
                  key={composite.composite}
                  composite={composite}
                />
              ))}
            </div>

            <StudentLevelChart domainLevels={domainLevels} />
          </>
        )}

        {sessions.length === 0 ? (
          <p className={`${cardClassName} text-sm text-muted`}>
            No analysis sessions yet for this student.
          </p>
        ) : (
          sessions.map((session) => (
            <AnalysisSessionArticle key={session.id} session={session} />
          ))
        )}
      </div>
    </DashboardShell>
  );
}
