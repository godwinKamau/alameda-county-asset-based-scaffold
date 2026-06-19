import type { ScaffoldSource } from "@/lib/types";
import { distributeScaffoldSources } from "@/lib/framework/sources";
import {
  parseInlineEmphasis,
  parseScaffoldItems,
  type TextSegment,
} from "@/lib/scaffold/format";
import { SaveInsightStar } from "./SaveInsightStar";
import { ScaffoldSourcePills } from "./ScaffoldSourcePills";

interface ScaffoldContentProps {
  text: string;
  sources?: ScaffoldSource[];
  sessionId?: string;
  savedIndices?: number[];
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

function SaveStarColumn({
  sessionId,
  itemIndex,
  savedIndices,
  number,
}: {
  sessionId?: string;
  itemIndex: number;
  savedIndices?: number[];
  number?: number;
}) {
  if (!sessionId) {
    if (number == null) return null;
    return (
      <span className="flex w-9 shrink-0 self-stretch flex-col items-center">
        <span className="pt-0.5 text-sm font-semibold leading-none text-blue-600">
          {number}.
        </span>
      </span>
    );
  }

  if (number == null) {
    return (
      <div className="group/star-col flex w-9 shrink-0 self-stretch flex-col items-center overflow-hidden transition-[width] duration-300 ease-out hover:w-40 focus-within:w-40">
        <div className="flex min-h-0 flex-1 items-center justify-center py-1">
          <SaveInsightStar
            sessionId={sessionId}
            itemIndex={itemIndex}
            initialSaved={isSaved(savedIndices, itemIndex)}
            size="lg"
            expandOnHover
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group/star-col flex w-9 shrink-0 self-stretch flex-col items-center overflow-hidden transition-[width] duration-300 ease-out hover:w-40 focus-within:w-40">
      {number != null && (
        <span className="shrink-0 pt-0.5 text-sm font-semibold leading-none text-blue-600">
          {number}.
        </span>
      )}
      <div className="flex min-h-0 flex-1 items-center justify-center py-1">
        <SaveInsightStar
          sessionId={sessionId}
          itemIndex={itemIndex}
          initialSaved={isSaved(savedIndices, itemIndex)}
          size="lg"
          expandOnHover
        />
      </div>
    </div>
  );
}

export function ScaffoldContent({
  text,
  sources = [],
  sessionId,
  savedIndices,
}: ScaffoldContentProps) {
  const items = parseScaffoldItems(text);
  const sourcesByItem = distributeScaffoldSources(items.length, sources);

  if (items.length <= 1 && !/^\d+\.\s/.test(text.trim())) {
    return (
      <div className="flex items-stretch gap-3 leading-relaxed">
        <SaveStarColumn
          sessionId={sessionId}
          itemIndex={0}
          savedIndices={savedIndices}
        />
        <p className="min-w-0 flex-1">
          {renderSegments(parseInlineEmphasis(text))}
          <ScaffoldSourcePills sources={sources} />
        </p>
      </div>
    );
  }

  return (
    <ol className="list-none space-y-4">
      {items.map((item, index) => (
        <li key={index} className="flex items-stretch gap-3 leading-relaxed">
          <SaveStarColumn
            sessionId={sessionId}
            itemIndex={index}
            savedIndices={savedIndices}
            number={index + 1}
          />
          <div className="min-w-0 flex-1 border-l-2 border-slate-100 pl-4">
            <p className="leading-relaxed">
              {renderSegments(parseInlineEmphasis(item))}
              <ScaffoldSourcePills sources={sourcesByItem[index] ?? []} />
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
