"use client";

import { useState } from "react";
import type { Insight } from "@/lib/types";
import { getCaEldLevelLabel, getElpacPerformanceLevelLabel } from "@/lib/elpac/labels";
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

interface InsightCardProps {
  insight: Insight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const [activeTab, setActiveTab] = useState<InsightTab>("scaffold");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Analysis insights"
        className="flex flex-wrap gap-2 border-b border-brand-soft pb-3"
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
            <ScaffoldContent text={insight.scaffold} />
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
                <p className="mt-1 text-2xl font-semibold leading-tight text-brand-dark">
                  {getCaEldLevelLabel(insight.estimated_level)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {getElpacPerformanceLevelLabel(insight.estimated_level)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
              Evidence from artifact
            </p>
            <div className="mt-2 text-brand-dark/90">
              <RichSentenceList text={insight.level_reasoning} />
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
            <RichSentenceList text={insight.strengths} />
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
            <RichSentenceList text={insight.gap_to_next} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
