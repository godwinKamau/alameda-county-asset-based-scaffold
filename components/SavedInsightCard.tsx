"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SavedInsight } from "@/lib/types";
import { parseInlineEmphasis, type TextSegment } from "@/lib/scaffold/format";
import { getStudentDisplayName } from "@/lib/roster/display";
import { cardClassName, linkClassName } from "@/lib/ui/styles";
import { SaveInsightStar } from "./SaveInsightStar";
import { ScaffoldSourcePills } from "./ScaffoldSourcePills";

interface SavedInsightCardProps {
  insight: SavedInsight;
}

function renderSegments(segments: TextSegment[]) {
  return segments.map((segment, index) =>
    segment.type === "strong" ? (
      <strong key={index} className="font-semibold text-slate-900">
        {segment.value}
      </strong>
    ) : (
      <span key={index}>{segment.value}</span>
    ),
  );
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function SavedInsightCard({ insight }: SavedInsightCardProps) {
  const router = useRouter();
  const studentName = getStudentDisplayName({
    label: insight.student_label,
    student_uuid: insight.student_uuid,
  });
  const submittedAt = toDate(insight.submitted_at);
  const createdAt = toDate(insight.created_at);

  return (
    <article className={cardClassName}>
      <div className="flex gap-3">
        <SaveInsightStar
          sessionId={insight.session_id}
          itemIndex={insight.item_index}
          initialSaved={true}
          itemText={insight.scaffold_text}
          itemSources={insight.scaffold_sources}
          onChange={(saved) => {
            if (!saved) {
              router.refresh();
            }
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="leading-relaxed text-brand-dark/90">
            {renderSegments(parseInlineEmphasis(insight.scaffold_text))}
            <ScaffoldSourcePills sources={insight.scaffold_sources ?? []} />
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-brand-soft pt-4 text-sm text-muted">
            <span className="font-medium text-brand-dark">{studentName}</span>
            <span>
              Level {insight.estimated_level}
            </span>
            <span>Grade span: {insight.grade_span}</span>
            <time dateTime={submittedAt.toISOString()}>
              Analysis: {submittedAt.toLocaleDateString()}
            </time>
            <time dateTime={createdAt.toISOString()}>
              Saved: {createdAt.toLocaleDateString()}
            </time>
            <Link
              href={`/analyze/results/${insight.session_id}`}
              className={linkClassName}
            >
              View analysis
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
