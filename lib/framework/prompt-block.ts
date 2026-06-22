import type { ExactGrade, GradeSpan } from "@/lib/types";
import { filterMovesForExactGrade } from "./merge";
import type { FrameworkLevelMoves, FrameworkMove } from "./types";

function formatPageCitation(move: FrameworkMove): string {
  if (move.source_chapter == null || move.source_page == null) {
    return "";
  }
  const page =
    move.source_page_end != null && move.source_page_end !== move.source_page
      ? `p.${move.source_page}–${move.source_page_end}`
      : `p.${move.source_page}`;
  return ` (Ch.${move.source_chapter} ${page})`;
}

export function formatFrameworkMove(move: FrameworkMove, id?: number): string {
  const prefix = id != null ? `[F${id}] ` : "";
  const target = move.language_target
    ? ` [target: ${move.language_target}]`
    : "";
  const citation = formatPageCitation(move);
  return `  - ${prefix}(${move.eld_mode}/${move.theme}) ${move.move}${target} — ${move.framework_anchor}${citation}`;
}

export interface FrameworkBlockResult {
  block: string;
  citableMoves: FrameworkMove[];
}

export function buildFrameworkBlockFromMoves(
  moves: FrameworkLevelMoves | null,
  gradeSpan: GradeSpan,
  exactGrade?: ExactGrade | null,
): FrameworkBlockResult {
  if (!moves) {
    return { block: "", citableMoves: [] };
  }

  const shouldFilterByGrade = gradeSpan === "3-12" && exactGrade != null;
  const citableMoves: FrameworkMove[] = [];
  let nextId = 1;

  const levelBlocks = (["1", "2", "3", "4"] as const)
    .map((level) => {
      const items = moves[level];
      if (!items || items.length === 0) {
        return null;
      }

      const filtered = shouldFilterByGrade
        ? filterMovesForExactGrade(items, exactGrade)
        : items;

      if (filtered.length === 0) {
        return null;
      }

      const formatted = filtered.map((move) => {
        const id = nextId++;
        citableMoves.push(move);
        return formatFrameworkMove(move, id);
      });

      return `For a student at Level ${level}:\n${formatted.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  if (!levelBlocks) {
    return { block: "", citableMoves: [] };
  }

  const block = `
SUGGESTED INSTRUCTIONAL MOVES (CA ELA/ELD Framework):
These are standards-aligned teaching moves grouped by level. When you write the
scaffold, SELECT moves that match the level you estimate and that target the
specific descriptors named in gap_to_next, then adapt each move to quote the
student's own writing. Prefer these over generic strategies. If no move fits the
artifact, you may go beyond this list, but stay consistent with these approaches.
Each move is tagged with [F#] for citation. Record the [F#] id(s) you used in
scaffold_source_ids when submitting your insight.
${levelBlocks}
`;

  return { block, citableMoves };
}
