"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InsightCard } from "@/components/InsightCard";
import { buildAnalyzeUrl } from "@/lib/analyze/url";
import {
  clearPendingAnalyzeRequest,
  getPendingAnalyzeRequest,
  type PendingAnalyzeContext,
} from "@/lib/analyze/pending-request";
import { consumeAnalyzeStream } from "@/lib/analyze/stream";
import { getCaEldLevelLabel } from "@/lib/elpac/labels";
import type { Insight } from "@/lib/types";
import { apiFetch, isDatabaseWakingError } from "@/lib/ui/api-fetch";
import { btnSecondaryClassName, cardClassName } from "@/lib/ui/styles";

export function StreamingAnalysisResults() {
  const router = useRouter();
  const [context, setContext] = useState<PendingAnalyzeContext | null>(null);
  const [partialInsight, setPartialInsight] = useState<Partial<Insight>>({});
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const pending = getPendingAnalyzeRequest();
    if (!pending) {
      router.replace("/analyze");
      return;
    }

    setContext(pending.context);
    const abortController = new AbortController();
    let cancelled = false;

    async function runAnalysis() {
      setStarted(true);

      try {
        const response = await apiFetch("/api/analyze", {
          method: "POST",
          body: pending!.formData,
          signal: abortController.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            typeof data.error === "string" ? data.error : "Analysis failed",
          );
        }

        if (!response.body) {
          throw new Error("Analysis failed. Please try again.");
        }

        const completed = await consumeAnalyzeStream(response.body, {
          onSnapshot: (insight) => {
            if (cancelled) return;
            setPartialInsight((current) => ({ ...current, ...insight }));
          },
          onComplete: (sessionId) => {
            if (!sessionId) {
              throw new Error("Analysis completed but no session was created.");
            }
            clearPendingAnalyzeRequest();
            router.replace(`/analyze/results/${sessionId}`);
          },
          onError: (message) => {
            throw new Error(message);
          },
        });

        if (!completed && !cancelled) {
          throw new Error("Analysis ended unexpectedly. Please try again.");
        }
      } catch (analysisError) {
        if (cancelled || isDatabaseWakingError(analysisError)) return;
        if (
          analysisError instanceof DOMException &&
          analysisError.name === "AbortError"
        ) {
          return;
        }
        clearPendingAnalyzeRequest();
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : "Analysis failed. Please try again.",
        );
      }
    }

    void runAnalysis();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [router]);

  if (!context) {
    return (
      <DashboardShell title="Analysis Results">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-muted" role="status">
            Preparing analysis…
          </p>
        </div>
      </DashboardShell>
    );
  }

  const backHref = buildAnalyzeUrl({
    student_uuid: context.studentUuid,
    subject: context.subject,
    grade_span: context.gradeSpan,
    known_elpac_level: context.providedLevel
      ? Number.parseInt(context.providedLevel, 10)
      : null,
  });

  const estimatedLevel = partialInsight.estimated_level;
  const eldLevelLabel =
    estimatedLevel != null ? getCaEldLevelLabel(estimatedLevel) : null;

  return (
    <DashboardShell title="Analysis Results">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href={backHref} className={btnSecondaryClassName}>
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
          {started && !error && (
            <p className="text-sm font-medium text-muted" role="status">
              Analysis in progress…
            </p>
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        <article className={cardClassName}>
          <header className="mb-6 border-b border-brand-soft pb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Analysis Results
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-brand-dark">
              {context.studentLabel}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {estimatedLevel != null && eldLevelLabel ? (
                <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark ring-1 ring-brand-soft">
                  Level {estimatedLevel} · {eldLevelLabel}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark ring-1 ring-brand-soft">
                  <span
                    className="h-3 w-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand"
                    aria-hidden="true"
                  />
                  Estimating level…
                </span>
              )}
              <span className="text-sm text-muted">
                Grade span: {context.gradeSpan}
              </span>
              {context.providedLevel && (
                <span className="text-sm text-muted">
                  Provided level: {context.providedLevel}
                </span>
              )}
            </div>
          </header>
          <InsightCard insight={partialInsight} streaming />
        </article>
      </div>
    </DashboardShell>
  );
}
