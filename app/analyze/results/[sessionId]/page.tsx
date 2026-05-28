import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { InsightCard } from "@/components/InsightCard";
import { buildAnalyzeUrl } from "@/lib/analyze/url";
import { recordAudit, hashEmail } from "@/lib/audit/log";
import {
  findTeacherByEmailHash,
  getSessionWithInsight,
} from "@/lib/db/queries";
import { getCaEldLevelLabel } from "@/lib/elpac/labels";
import { getStudentDisplayName } from "@/lib/roster/display";

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

  const teacher = await findTeacherByEmailHash(hashEmail(email));
  if (!teacher) redirect("/dashboard");

  const session = await getSessionWithInsight(teacher.id, sessionId);
  if (!session) notFound();

  const headerList = await headers();
  const req = new Request("http://localhost", {
    headers: headerList,
  });

  await recordAudit({
    actorId: teacher.id,
    action: "analysis.read",
    resourceType: "analysis_session",
    resourceId: sessionId,
    req,
  });

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
  const eldLevelLabel = getCaEldLevelLabel(estimatedLevel);

  return (
    <>
      <AppHeader title="Analysis Results" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={newAnalysisHref}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
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
          </Link>
          <time
            dateTime={session.submitted_at.toISOString()}
            className="text-sm text-slate-600"
          >
            {new Date(session.submitted_at).toLocaleString()}
          </time>
        </div>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <header className="mb-6 border-b border-slate-100 pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Analysis Results
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              {studentName}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900 ring-1 ring-blue-100">
                Level {estimatedLevel} · {eldLevelLabel}
              </span>
              <span className="text-sm text-slate-600">
                Grade span: {session.grade_span}
              </span>
              {session.provided_elpac_level != null && (
                <span className="text-sm text-slate-600">
                  Provided level: {session.provided_elpac_level}
                </span>
              )}
            </div>
          </header>
          <InsightCard insight={session.insight} />
        </article>
      </main>
    </>
  );
}
