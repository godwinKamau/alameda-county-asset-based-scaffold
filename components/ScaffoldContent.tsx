import {
  parseInlineEmphasis,
  parseScaffoldItems,
  type TextSegment,
} from "@/lib/scaffold/format";

interface ScaffoldContentProps {
  text: string;
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

export function ScaffoldContent({ text }: ScaffoldContentProps) {
  const items = parseScaffoldItems(text);

  if (items.length <= 1 && !/^\d+\.\s/.test(text.trim())) {
    return (
      <p className="leading-relaxed">{renderSegments(parseInlineEmphasis(text))}</p>
    );
  }

  return (
    <ol className="list-none space-y-4">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 leading-relaxed">
          <span className="w-5 shrink-0 pt-0.5 text-right text-sm font-semibold text-blue-600">
            {index + 1}.
          </span>
          <div className="min-w-0 border-l-2 border-slate-100 pl-4">
            {renderSegments(parseInlineEmphasis(item))}
          </div>
        </li>
      ))}
    </ol>
  );
}
