"use client";

import { useState, useTransition } from "react";
import type { ScaffoldSource } from "@/lib/types";
import { navColActionButtonClassName, navColHoverLabelClassName } from "@/lib/ui/styles";

interface SaveInsightStarProps {
  sessionId: string;
  itemIndex: number;
  initialSaved: boolean;
  onChange?: (saved: boolean) => void;
  itemText?: string;
  itemSources?: ScaffoldSource[];
  size?: "default" | "lg";
  expandOnHover?: boolean;
}

const sizeClassNames = {
  default: {
    button: "h-7 w-7",
    icon: "h-5 w-5",
  },
  lg: {
    button: "h-9 w-9",
    icon: "h-7 w-7",
  },
} as const;

export function SaveInsightStar({
  sessionId,
  itemIndex,
  initialSaved,
  onChange,
  itemText,
  itemSources,
  size = "default",
  expandOnHover = false,
}: SaveInsightStarProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  const hoverLabel = saved
    ? "Remove from Saved Insights"
    : "Save insight";

  function buildRequestBody() {
    const body: {
      sessionId: string;
      itemIndex: number;
      text?: string;
      sources?: ScaffoldSource[];
    } = { sessionId, itemIndex };

    if (itemText) {
      body.text = itemText;
      if (itemSources?.length) {
        body.sources = itemSources;
      }
    }

    return body;
  }

  function toggleSaved() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    onChange?.(nextSaved);

    startTransition(async () => {
      try {
        const response = await fetch("/api/insights/saved", {
          method: nextSaved ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildRequestBody()),
        });

        if (!response.ok) {
          setSaved(!nextSaved);
          onChange?.(!nextSaved);
        }
      } catch {
        setSaved(!nextSaved);
        onChange?.(!nextSaved);
      }
    });
  }

  const { icon: iconSizeClassName } = sizeClassNames[size];

  if (expandOnHover) {
    return (
      <button
        type="button"
        onClick={toggleSaved}
        disabled={isPending}
        aria-label={hoverLabel}
        aria-pressed={saved}
        className={`${navColActionButtonClassName} ${
          saved
            ? "text-amber-500 hover:text-amber-600"
            : "text-slate-300 hover:text-amber-400"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={saved ? 0 : 1.75}
          className={`${iconSizeClassName} shrink-0`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
        <span aria-hidden="true" className={navColHoverLabelClassName}>
          {hoverLabel}
        </span>
      </button>
    );
  }

  const buttonSizeClassName = sizeClassNames[size].button;

  const hoverLabelClasses =
    "pointer-events-none absolute top-full z-10 mt-1 hidden w-max max-w-[9rem] text-center text-[11px] leading-tight text-muted group-hover:block group-focus-within:block";

  return (
    <div className="group relative flex shrink-0 flex-col items-center">
      <button
        type="button"
        onClick={toggleSaved}
        disabled={isPending}
        aria-label={hoverLabel}
        aria-pressed={saved}
        className={`inline-flex ${buttonSizeClassName} shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 ${
          saved
            ? "text-amber-500 hover:text-amber-600"
            : "text-slate-300 hover:text-amber-400"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={saved ? 0 : 1.75}
          className={iconSizeClassName}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      </button>
      <span aria-hidden="true" className={hoverLabelClasses}>
        {hoverLabel}
      </span>
    </div>
  );
}
