import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DbWakingBanner } from "@/components/DbWakingBanner";
import { InsightCard } from "@/components/InsightCard";
import { buildAnalyzeUrl } from "@/lib/analyze/url";
import { getStudentAccess } from "@/lib/auth/student-access";
import { recordAudit, hashEmail } from "@/lib/audit/log";
import { isDatabaseWakingError } from "@/lib/db/errors";
import {
  findTeacherByEmailHash,
  getSessionWithInsight,
  listSavedItemIndicesForSession,
} from "@/lib/db/queries";
import { getStudentDisplayName } from "@/lib/roster/display";
import { btnSecondaryClassName, cardClassName } from "@/lib/ui/styles";

interface AnalysisResultsPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function AnalysisResultsPage({
  params,
}: AnalysisResultsPageProps) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  let teacher: Awaited<ReturnType<typeof findTeacherByEmailHash>>;
  let session: Awaited<ReturnType<typeof getSessionWithInsight>> = null;
  let savedScaffoldIndices: number[] = [];

  try {
    teacher = await findTeacherByEmailHash(hashEmail(email));
    if (teacher) {
      const sessionRow = await getSessionWithInsight(sessionId);
      if (sessionRow) {
        const access = await getStudentAccess(
          teacher.id,
          sessionRow.student_uuid,
        );
        if (access) {
          session = sessionRow;
          savedScaffoldIndices = await listSavedItemIndicesForSession(
            teacher.id,
            sessionId,
          );
          const headerList = await headers();
          await recordAudit({
            actorId: teacher.id,
            action: "analysis.read",
            resourceType: "analysis_session",
            resourceId: sessionId,
            req: new Request("http://localhost", { headers: headerList }),
            authorizedBy: access.grantId,
            authorizedByType: "grade_grant",
          });
        }
      }
    }
  } catch (err) {
    if (isDatabaseWakingError(err)) {
      return (
        <DashboardShell title="Analysis Results">
          <DbWakingBanner />
        </DashboardShell>
      );
    }
    throw err;
  }

  if (!teacher) redirect("/dashboard");
  if (!session) notFound();

  const newAnalysisHref = buildAnalyzeUrl({
    student_uuid: session.student_uuid,
    subject: session.subject,
    grade_span: session.grade_span,
    known_elpac_level: session.provided_elpac_level,
  });

  const studentName = getStudentDisplayName({
    label: session.student_label,
    student_uuid: session.student_uuid,
  });
  const estimatedLevel = session.insight.estimated_level;

  return (
    <DashboardShell title="Analysis Results">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={newAnalysisHref} className={btnSecondaryClassName}>
            <span className="inline-flex items-center gap-2">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                  clipRule="evenodd"
                />
              </svg>
              Back to analysis
            </span>
          </Link>
          <time
            dateTime={session.submitted_at.toISOString()}
            className="text-sm text-muted"
          >
            {new Date(session.submitted_at).toLocaleString()}
          </time>
        </div>

        <article className={cardClassName}>
          <header className="mb-6 border-b border-brand-soft pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Analysis Results
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-brand-dark">
              {studentName}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark ring-1 ring-brand-soft">
                Level {estimatedLevel}
              </span>
              <span className="text-sm text-muted">
                Grade span: {session.grade_span}
              </span>
              {session.provided_elpac_level != null && (
                <span className="text-sm text-muted">
                  Provided level: {session.provided_elpac_level}
                </span>
              )}
            </div>
          </header>
          <InsightCard
            insight={session.insight}
            sessionId={sessionId}
            savedScaffoldIndices={savedScaffoldIndices}
          />
        </article>
      </div>
    </DashboardShell>
  );
}
