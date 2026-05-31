import type { ExactGrade, GradeSpan } from "@/lib/types";
import { filterMovesForExactGrade } from "./merge";
import type { FrameworkLevelMoves, FrameworkMove } from "./types";

export function formatFrameworkMove(move: FrameworkMove): string {
  const target = move.language_target
    ? ` [target: ${move.language_target}]`
    : "";
  return `  - (${move.eld_mode}/${move.theme}) ${move.move}${target} — ${move.framework_anchor}`;
}

export function buildFrameworkBlockFromMoves(
  moves: FrameworkLevelMoves | null,
  gradeSpan: GradeSpan,
  exactGrade?: ExactGrade | null,
): string {
  if (!moves) {
    return "";
  }

  const shouldFilterByGrade = gradeSpan === "3-12" && exactGrade != null;

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

      return `For a student at Level ${level}:\n${filtered.map(formatFrameworkMove).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  if (!levelBlocks) {
    return "";
  }

  return `
SUGGESTED INSTRUCTIONAL MOVES (CA ELA/ELD Framework):
These are standards-aligned teaching moves grouped by level. When you write the
scaffold, SELECT moves that match the level you estimate and that target the
specific descriptors named in gap_to_next, then adapt each move to quote the
student's own writing. Prefer these over generic strategies. If no move fits the
artifact, you may go beyond this list, but stay consistent with these approaches.
${levelBlocks}
`;
}
