import type { ExactGrade } from "@/lib/types";
import type {
  FrameworkGradeSpan,
  FrameworkLevelMoves,
  FrameworkMove,
  GradeBand,
} from "./types";

const GRADE_BAND_GRADES: Record<GradeBand, ExactGrade[]> = {
  "TK-1": ["K", "1"],
  "2-3": ["2", "3"],
  "4-5": ["4", "5"],
  "6-8": ["6", "7", "8"],
  "9-12": ["9", "10", "11", "12"],
};

export function gradeBandMatchesExactGrade(
  gradeBand: GradeBand | undefined,
  exactGrade: ExactGrade,
): boolean {
  if (!gradeBand) {
    return false;
  }
  return GRADE_BAND_GRADES[gradeBand].includes(exactGrade);
}

export function filterMovesForExactGrade(
  moves: FrameworkMove[],
  exactGrade: ExactGrade | null | undefined,
): FrameworkMove[] {
  if (!exactGrade) {
    return moves;
  }

  const preferred = moves.filter((move) =>
    gradeBandMatchesExactGrade(move.grade_band, exactGrade),
  );
  if (preferred.length > 0) {
    return preferred;
  }

  const untagged = moves.filter((move) => move.grade_band == null);
  if (untagged.length > 0) {
    return untagged;
  }

  return moves;
}

export function mergeFrameworkGradeSpans(
  target: FrameworkGradeSpan,
  source: FrameworkGradeSpan,
): void {
  for (const [span, levels] of Object.entries(source)) {
    if (!levels) {
      continue;
    }

    const spanKey = span as keyof FrameworkGradeSpan;
    if (!target[spanKey]) {
      target[spanKey] = {};
    }

    const targetSpan = target[spanKey]!;
    for (const [level, moves] of Object.entries(levels)) {
      if (!moves) {
        continue;
      }

      const levelKey = level as keyof FrameworkLevelMoves;
      targetSpan[levelKey] = [...(targetSpan[levelKey] ?? []), ...moves];
    }
  }
}
