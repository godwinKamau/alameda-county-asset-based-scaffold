"use client";

import { useState } from "react";
import type { Insight } from "@/lib/types";
import { getCaEldLevelLabel, getElpacPerformanceLevelLabel } from "@/lib/elpac/labels";
import { Panel } from "./Panel";
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
    activeClass: "border-blue-600 bg-blue-50 text-blue-800",
    inactiveClass:
      "border-transparent text-slate-600 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700",
  },
  {
    id: "level",
    label: "Estimated Level",
    shortLabel: "Level",
    activeClass: "border-slate-500 bg-slate-100 text-slate-900",
    inactiveClass:
      "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800",
  },
  {
    id: "strengths",
    label: "Observed Strengths",
    shortLabel: "Strengths",
    activeClass: "border-emerald-600 bg-emerald-50 text-emerald-900",
    inactiveClass:
      "border-transparent text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800",
  },
  {
    id: "gap",
    label: "Gap to Next Level",
    shortLabel: "Gap",
    activeClass: "border-amber-600 bg-amber-50 text-amber-900",
    inactiveClass:
      "border-transparent text-slate-600 hover:border-amber-200 hover:bg-amber-50/60 hover:text-amber-800",
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
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
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
            className="p-6 shadow-md ring-1 ring-blue-100"
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
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200"
              >
                <span className="text-3xl font-bold tabular-nums text-slate-900">
                  {insight.estimated_level}
                </span>
              </div>
              <div className="min-w-0 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  ELPAC Level {insight.estimated_level}
                </p>
                <p className="mt-1 text-2xl font-semibold leading-tight text-slate-900">
                  {getCaEldLevelLabel(insight.estimated_level)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {getElpacPerformanceLevelLabel(insight.estimated_level)}
                </p>
              </div>
            </div>
            <p className="mt-4 leading-relaxed text-slate-700">
              {insight.level_reasoning}
            </p>
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
            <p className="leading-relaxed">{insight.strengths}</p>
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
            <p className="leading-relaxed">{insight.gap_to_next}</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
