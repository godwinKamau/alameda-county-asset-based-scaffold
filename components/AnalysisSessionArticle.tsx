"use client";

import { useState } from "react";
import type { AnalysisSessionWithInsight } from "@/lib/types";
import { getCaEldLevelLabel } from "@/lib/elpac/labels";
import { cardClassName } from "@/lib/ui/styles";
import { InsightCard } from "./InsightCard";

interface AnalysisSessionArticleProps {
  session: AnalysisSessionWithInsight;
}

export function AnalysisSessionArticle({ session }: AnalysisSessionArticleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const estimatedLevel = session.insight.estimated_level;
  const eldLevelLabel = getCaEldLevelLabel(estimatedLevel);
  const submittedAt = new Date(session.submitted_at);

  return (
    <article className={`${cardClassName} bg-brand-soft/20`}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex w-full items-start gap-3 text-left"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <time dateTime={submittedAt.toISOString()}>
              {submittedAt.toLocaleString()}
            </time>
            <span>Domain: {session.domain}</span>
            <span>Grade span: {session.grade_span}</span>
            {session.provided_elpac_level != null && (
              <span>Provided level: {session.provided_elpac_level}</span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-brand-dark">
            Level {estimatedLevel} · {eldLevelLabel}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 border-t border-brand-soft/80 pt-4">
          <InsightCard insight={session.insight} />
        </div>
      )}
    </article>
  );
}
