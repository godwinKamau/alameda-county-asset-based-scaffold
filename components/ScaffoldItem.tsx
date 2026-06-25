"use client";

import { useState } from "react";
import type { RemixScaffoldResult, ScaffoldSource } from "@/lib/types";
import {
  parseInlineEmphasis,
  type TextSegment,
} from "@/lib/scaffold/format";
import {
  navColActionButtonClassName,
  navColHoverLabelClassName,
} from "@/lib/ui/styles";
import { SaveInsightStar } from "./SaveInsightStar";
import { ScaffoldSourcePills } from "./ScaffoldSourcePills";

type ItemView = "original" | "remixed";

interface ScaffoldItemProps {
  itemText: string;
  itemIndex: number;
  itemSources?: ScaffoldSource[];
  sessionId?: string;
  savedIndices?: number[];
  number?: number;
  bordered?: boolean;
}

function renderSegments(segments: TextSegment[]) {
  return segments.map((segment, index) =>
    segment.type === "strong" ? (
      <strong
        key={index}
        className="font-semibold text-slate-900"
      >
        {segment.value}
      </strong>
    ) : (
      <span key={index}>{segment.value}</span>
    ),
  );
}

function isSaved(savedIndices: number[] | undefined, index: number): boolean {
  return savedIndices?.includes(index) ?? false;
}

const navColumnClassName =
  "group/nav-col flex w-11 shrink-0 self-stretch flex-col items-center overflow-hidden transition-[width] duration-300 ease-out hover:w-44";

export function ScaffoldItem({
  itemText,
  itemIndex,
  itemSources = [],
  sessionId,
  savedIndices,
  number,
  bordered = false,
}: ScaffoldItemProps) {
  const [view, setView] = useState<ItemView>("original");
  const [remixText, setRemixText] = useState<string | null>(null);
  const [remixSources, setRemixSources] = useState<ScaffoldSource[]>([]);
  const [priorRemixes, setPriorRemixes] = useState<string[]>([]);
  const [isRemixing, setIsRemixing] = useState(false);
  const [remixError, setRemixError] = useState<string | null>(null);

  const showingRemixed = view === "remixed" && remixText != null;
  const displayText = showingRemixed ? remixText : itemText;
  const displaySources = showingRemixed ? remixSources : itemSources;

  const remixLabel = isRemixing
    ? "Generating alternative…"
    : remixText
      ? "Generate another alternative"
      : "Generate a different insight";

  async function generateRemix() {
    if (!sessionId) return;

    setIsRemixing(true);
    setRemixError(null);

    try {
      const response = await fetch("/api/insights/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          itemIndex,
          ...(priorRemixes.length > 0 ? { priorRemixTexts: priorRemixes } : {}),
        }),
      });

      const data = (await response.json()) as RemixScaffoldResult & {
        error?: string;
      };

      if (!response.ok) {
        setRemixError(
          data.error ?? "Failed to generate an alternative insight.",
        );
        return;
      }

      setRemixText(data.scaffold);
      setRemixSources(data.scaffold_sources ?? []);
      setPriorRemixes((current) => [...current, data.scaffold]);
      setView("remixed");
    } catch {
      setRemixError("Failed to generate an alternative insight.");
    } finally {
      setIsRemixing(false);
    }
  }

  const starProps = sessionId
    ? {
        sessionId,
        itemIndex,
        initialSaved: showingRemixed
          ? false
          : isSaved(savedIndices, itemIndex),
        size: "lg" as const,
        expandOnHover: true,
        ...(showingRemixed && remixText
          ? { itemText: remixText, itemSources: remixSources }
          : {}),
      }
    : null;

  const itemParagraph = (
    <p className="leading-relaxed">
      {renderSegments(parseInlineEmphasis(displayText))}
      <ScaffoldSourcePills sources={displaySources} />
    </p>
  );

  const itemBody = (
    <>
      <div className={navColumnClassName}>
        {number != null && (
          <span className="shrink-0 pt-0.5 text-sm font-semibold leading-none text-blue-600">
            {number}.
          </span>
        )}

        <div className="flex min-h-0 w-full flex-1 flex-col items-stretch justify-evenly py-2">
          {starProps ? (
            <SaveInsightStar key={view} {...starProps} />
          ) : number == null ? null : (
            <span className="h-11 shrink-0" aria-hidden="true" />
          )}

          {sessionId && (
            <>
              <button
                type="button"
                onClick={() => void generateRemix()}
                disabled={isRemixing}
                title={remixLabel}
                aria-label={remixLabel}
                className={`${navColActionButtonClassName} text-slate-400 hover:text-brand`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className={`h-7 w-7 shrink-0 ${isRemixing ? "animate-spin" : ""}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                <span aria-hidden="true" className={navColHoverLabelClassName}>
                  Find More Insights
                </span>
              </button>

              {remixText && (
                <div
                  role="group"
                  aria-label="Insight version"
                  className="flex flex-col gap-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setView("original")}
                    aria-pressed={view === "original"}
                    title="Show original"
                    className={`rounded px-1 py-0.5 text-[10px] font-medium leading-tight transition-colors hover:bg-brand-soft ${
                      view === "original"
                        ? "bg-brand-soft text-brand-dark"
                        : "text-muted hover:text-brand-dark"
                    }`}
                  >
                    Orig
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("remixed")}
                    aria-pressed={view === "remixed"}
                    title="Show alternative"
                    className={`rounded px-1 py-0.5 text-[10px] font-medium leading-tight transition-colors hover:bg-brand-soft ${
                      view === "remixed"
                        ? "bg-brand-soft text-brand-dark"
                        : "text-muted hover:text-brand-dark"
                    }`}
                  >
                    Alt
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div
        className={
          bordered
            ? "min-w-0 flex-1 border-l-2 border-slate-100 pl-4"
            : "min-w-0 flex-1"
        }
      >
        {remixError && (
          <p className="mb-2 text-xs text-accent-orange" role="alert">
            {remixError}
          </p>
        )}
        {itemParagraph}
      </div>
    </>
  );

  if (number != null) {
    return (
      <li className="flex items-stretch gap-3 leading-relaxed">{itemBody}</li>
    );
  }

  return (
    <div className="flex items-stretch gap-3 leading-relaxed">{itemBody}</div>
  );
}
