import type { ScaffoldSource } from "@/lib/types";
import {
  formatScaffoldSourceChipLabel,
  formatScaffoldSourceLabel,
  scaffoldSourceHref,
} from "@/lib/framework/sources";

interface ScaffoldSourcePillsProps {
  sources: ScaffoldSource[];
}

export function ScaffoldSourcePills({ sources }: ScaffoldSourcePillsProps) {
  if (!sources.length) {
    return null;
  }

  return (
    <span className="ml-1.5 inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1 align-middle">
      {sources.map((source, index) => (
        <a
          key={`${source.chapter}-${source.page}-${index}`}
          href={scaffoldSourceHref(source)}
          target="_blank"
          rel="noopener noreferrer"
          title={source.anchor ?? formatScaffoldSourceLabel(source)}
          className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/80 transition-colors hover:bg-slate-200 hover:text-slate-800"
        >
          {formatScaffoldSourceChipLabel(source)}
        </a>
      ))}
    </span>
  );
}
