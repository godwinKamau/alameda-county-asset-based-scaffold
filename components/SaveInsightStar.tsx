"use client";

import { useState, useTransition } from "react";

interface SaveInsightStarProps {
  sessionId: string;
  itemIndex: number;
  initialSaved: boolean;
  onChange?: (saved: boolean) => void;
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
  size = "default",
  expandOnHover = false,
}: SaveInsightStarProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  const hoverLabel = saved
    ? "Remove from Saved Insights"
    : "Save insight";

  function toggleSaved() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    onChange?.(nextSaved);

    startTransition(async () => {
      try {
        const response = await fetch("/api/insights/saved", {
          method: nextSaved ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, itemIndex }),
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

  const { button: buttonSizeClassName, icon: iconSizeClassName } =
    sizeClassNames[size];

  const hoverLabelClasses = expandOnHover
    ? "max-w-0 overflow-hidden whitespace-nowrap pl-0 text-[11px] leading-tight text-muted opacity-0 transition-all duration-300 ease-out group-hover/star-col:max-w-[8.5rem] group-hover/star-col:pl-1.5 group-hover/star-col:opacity-100 group-focus-within/star-col:max-w-[8.5rem] group-focus-within/star-col:pl-1.5 group-focus-within/star-col:opacity-100"
    : "pointer-events-none absolute top-full z-10 mt-1 hidden w-max max-w-[9rem] text-center text-[11px] leading-tight text-muted group-hover:block group-focus-within:block";

  return (
    <div
      className={`relative flex shrink-0 ${expandOnHover ? "items-center" : "group flex-col items-center"}`}
    >
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
