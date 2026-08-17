"use client";

import { useState } from "react";
import type { Insight } from "@/lib/types";
import { LevelSkeleton, SectionSkeleton } from "./InsightSkeletons";
import { Panel } from "./Panel";
import { RichSentenceList } from "./RichSentenceList";
import { ScaffoldContent } from "./ScaffoldContent";

type InsightTab = "scaffold" | "level" | "strengths" | "gap";

const TABS: {
  id: InsightTab;
  label: string;
  shortLabel: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    id: "scaffold",
    label: "Asset-Based Scaffold",
    shortLabel: "Scaffold",
    activeClass: "border-brand bg-brand-soft text-brand-dark",
    inactiveClass:
      "border-transparent text-muted hover:border-brand-soft hover:bg-brand-soft/60 hover:text-brand-dark",
  },
  {
    id: "level",
    label: "Estimated Level",
    shortLabel: "Level",
    activeClass: "border-brand bg-brand-soft text-brand-dark",
    inactiveClass:
      "border-transparent text-muted hover:border-brand-soft hover:bg-slate-50 hover:text-brand-dark",
  },
  {
    id: "strengths",
    label: "Observed Strengths",
    shortLabel: "Strengths",
    activeClass: "border-accent-green bg-emerald-50 text-brand-dark",
    inactiveClass:
      "border-transparent text-muted hover:border-accent-green/30 hover:bg-emerald-50/60 hover:text-brand-dark",
  },
  {
    id: "gap",
    label: "Gap to Next Level",
    shortLabel: "Gap",
    activeClass: "border-accent-orange bg-orange-50 text-brand-dark",
    inactiveClass:
      "border-transparent text-muted hover:border-accent-orange/30 hover:bg-orange-50/60 hover:text-brand-dark",
  },
];

function isCompleteInsight(
  insight: Insight | Partial<Insight>,
): insight is Insight {
  return (
    typeof insight.strengths === "string" &&
    insight.strengths.length > 0 &&
    typeof insight.estimated_level === "number" &&
    typeof insight.level_reasoning === "string" &&
    insight.level_reasoning.length > 0 &&
    typeof insight.gap_to_next === "string" &&
    insight.gap_to_next.length > 0 &&
    typeof insight.scaffold === "string" &&
    insight.scaffold.length > 0
  );
}

interface InsightCardProps {
  insight: Insight | Partial<Insight>;
  sessionId?: string;
  savedScaffoldIndices?: number[];
  streaming?: boolean;
}

export function InsightCard({
  insight,
  sessionId,
  savedScaffoldIndices,
  streaming = false,
}: InsightCardProps) {
  const [activeTab, setActiveTab] = useState<InsightTab>("scaffold");

  const hasScaffold = Boolean(insight.scaffold?.trim());
  const hasLevel = insight.estimated_level != null;
  const hasLevelReasoning = Boolean(insight.level_reasoning?.trim());
  const hasStrengths = Boolean(insight.strengths?.trim());
  const hasGap = Boolean(insight.gap_to_next?.trim());
  const fullInsight = !streaming && isCompleteInsight(insight) ? insight : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-soft pb-3">
        <div
          role="tablist"
          aria-label="Analysis insights"
          className="flex flex-wrap gap-2"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`insight-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`insight-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                  isActive ? tab.activeClass : tab.inactiveClass
                }`}
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-4 min-h-[12rem]">
        <div
          role="tabpanel"
          id="insight-panel-scaffold"
          aria-labelledby="insight-tab-scaffold"
          hidden={activeTab !== "scaffold"}
          className={
            activeTab === "scaffold"
              ? "relative"
              : "pointer-events-none absolute inset-x-0 top-0 opacity-0"
          }
        >
          <Panel
            title="Asset-Based Scaffold"
            variant="scaffold"
            showTitle={false}
            className="p-6 shadow-md ring-1 ring-brand-soft"
          >
            {fullInsight ? (
              <ScaffoldContent
                text={fullInsight.scaffold}
                sources={fullInsight.scaffold_sources}
                sessionId={sessionId}
                savedIndices={savedScaffoldIndices}
              />
            ) : hasScaffold ? (
              <div className="leading-relaxed text-brand-dark/90">
                <RichSentenceList text={insight.scaffold!} />
              </div>
            ) : (
              <SectionSkeleton lines={4} />
            )}
          </Panel>
        </div>

        <div
          role="tabpanel"
          id="insight-panel-level"
          aria-labelledby="insight-tab-level"
          hidden={activeTab !== "level"}
          className={
            activeTab === "level"
              ? "relative"
              : "pointer-events-none absolute inset-x-0 top-0 opacity-0"
          }
        >
          <Panel title="Estimated Level" variant="level" showTitle={false}>
            {hasLevel ? (
              <div className="flex items-start gap-4">
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-soft ring-1 ring-brand-soft"
                >
                  <span className="text-3xl font-bold tabular-nums text-brand-dark">
                    {insight.estimated_level}
                  </span>
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    ELPAC Level {insight.estimated_level}
                  </p>
                </div>
              </div>
            ) : (
              <LevelSkeleton />
            )}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
              Evidence from artifact
            </p>
            <div className="mt-2 text-brand-dark/90">
              {hasLevelReasoning ? (
                <RichSentenceList text={insight.level_reasoning!} />
              ) : (
                <SectionSkeleton lines={2} />
              )}
            </div>
          </Panel>
        </div>

        <div
          role="tabpanel"
          id="insight-panel-strengths"
          aria-labelledby="insight-tab-strengths"
          hidden={activeTab !== "strengths"}
          className={
            activeTab === "strengths"
              ? "relative"
              : "pointer-events-none absolute inset-x-0 top-0 opacity-0"
          }
        >
          <Panel title="Observed Strengths" variant="strengths" showTitle={false}>
            {hasStrengths ? (
              <RichSentenceList text={insight.strengths!} />
            ) : (
              <SectionSkeleton />
            )}
          </Panel>
        </div>

        <div
          role="tabpanel"
          id="insight-panel-gap"
          aria-labelledby="insight-tab-gap"
          hidden={activeTab !== "gap"}
          className={
            activeTab === "gap"
              ? "relative"
              : "pointer-events-none absolute inset-x-0 top-0 opacity-0"
          }
        >
          <Panel title="Gap to Next Level" variant="gap" showTitle={false}>
            {hasGap ? (
              <RichSentenceList text={insight.gap_to_next!} />
            ) : (
              <SectionSkeleton />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
