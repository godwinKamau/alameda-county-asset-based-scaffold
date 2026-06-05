import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DbWakingBanner } from "@/components/DbWakingBanner";
import { AnalysisSessionArticle } from "@/components/AnalysisSessionArticle";
import { StudentLevelChart, computeDomainLevels } from "@/components/StudentLevelChart";
import { StudentNameHeading } from "@/components/StudentNameHeading";
import { recordAudit, hashEmail } from "@/lib/audit/log";
import { isDatabaseWakingError } from "@/lib/db/errors";
import {
  findTeacherByEmailHash,
  getRosterEntryLabel,
  listSessionsForStudent,
  rosterEntryBelongsToTeacher,
} from "@/lib/db/queries";
import {
  getCaEldLevelLabel,
  getElpacPerformanceLevelLabel,
} from "@/lib/elpac/labels";
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

  let teacher: Awaited<ReturnType<typeof findTeacherByEmailHash>>;
  let ownsStudent = false;
  let sessions: Awaited<ReturnType<typeof listSessionsForStudent>> = [];
  let label: string | null = null;

  try {
    teacher = await findTeacherByEmailHash(hashEmail(email));
    if (teacher) {
      ownsStudent = await rosterEntryBelongsToTeacher(teacher.id, uuid);
    }
    if (teacher && ownsStudent) {
      [sessions, label] = await Promise.all([
        listSessionsForStudent(teacher.id, uuid),
        getRosterEntryLabel(teacher.id, uuid),
      ]);

      const headerList = await headers();
      await recordAudit({
        actorId: teacher.id,
        action: "analysis.read",
        resourceType: "student",
        resourceId: uuid,
        req: new Request("http://localhost", { headers: headerList }),
      });
    }
  } catch (err) {
    if (isDatabaseWakingError(err)) {
      return (
        <DashboardShell title="Student History">
          <DbWakingBanner />
        </DashboardShell>
      );
    }
    throw err;
  }

  if (!teacher) redirect("/dashboard");
  if (!ownsStudent) redirect("/dashboard");

  const avgLevel =
    sessions.length > 0
      ? sessions.reduce(
          (sum, session) => sum + session.insight.estimated_level,
          0,
        ) / sessions.length
      : null;

  const roundedAvgLevel =
    avgLevel != null ? Math.round(avgLevel * 10) / 10 : null;

  const domainLevels = computeDomainLevels(
    sessions.map((session) => ({
      domain: session.domain,
      estimated_level: session.insight.estimated_level,
    })),
  );

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
            <div className="ui-card p-6">
              <p className="text-sm font-medium text-muted">
                Average estimated level
              </p>
              <div className="mt-3 flex items-start gap-4">
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-soft ring-1 ring-brand-soft"
                >
                  <span className="text-3xl font-bold tabular-nums text-brand-dark">
                    {roundedAvgLevel}
                  </span>
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    ELPAC Level {Math.round(roundedAvgLevel!)}
                  </p>
                  <p className="mt-1 text-2xl font-semibold leading-tight text-brand-dark">
                    {getCaEldLevelLabel(Math.round(roundedAvgLevel!))}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {getElpacPerformanceLevelLabel(Math.round(roundedAvgLevel!))}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Based on {sessions.length}{" "}
                    {sessions.length === 1 ? "analysis" : "analyses"}
                  </p>
                </div>
              </div>
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
