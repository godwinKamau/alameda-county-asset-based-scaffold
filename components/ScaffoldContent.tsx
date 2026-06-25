import type { ScaffoldSource } from "@/lib/types";
import { distributeScaffoldSources } from "@/lib/framework/sources";
import { parseScaffoldItems } from "@/lib/scaffold/format";
import { ScaffoldItem } from "./ScaffoldItem";

interface ScaffoldContentProps {
  text: string;
  sources?: ScaffoldSource[];
  sessionId?: string;
  savedIndices?: number[];
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
      <ScaffoldItem
        itemText={text}
        itemIndex={0}
        itemSources={sources}
        sessionId={sessionId}
        savedIndices={savedIndices}
      />
    );
  }

  return (
    <ol className="list-none space-y-4">
      {items.map((item, index) => (
        <ScaffoldItem
          key={index}
          itemText={item}
          itemIndex={index}
          itemSources={sourcesByItem[index] ?? []}
          sessionId={sessionId}
          savedIndices={savedIndices}
          number={index + 1}
          bordered
        />
      ))}
    </ol>
  );
}
