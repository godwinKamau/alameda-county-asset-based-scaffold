import {
  parseSentences,
  type TextSegment,
} from "@/lib/scaffold/format";

interface RichSentenceListProps {
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

export function RichSentenceList({ text }: RichSentenceListProps) {
  const sentences = parseSentences(text);

  if (sentences.length <= 1) {
    const segments = sentences[0] ?? [{ type: "text" as const, value: text }];
    return <p className="leading-relaxed">{renderSegments(segments)}</p>;
  }

  return (
    <ul className="list-none space-y-3">
      {sentences.map((segments, index) => (
        <li key={index} className="flex gap-3 leading-relaxed">
          <span
            aria-hidden="true"
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40"
          />
          <span className="min-w-0">{renderSegments(segments)}</span>
        </li>
      ))}
    </ul>
  );
}
