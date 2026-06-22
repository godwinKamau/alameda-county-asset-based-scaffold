import path from "path";
import type { GradeSpan } from "@/lib/types";
import { loadFrameworkMovesFromDirectory } from "./load-core";
import type { FrameworkLevelMoves, FrameworkMoves } from "./types";

let cached: FrameworkMoves | null | undefined;

export function loadFrameworkMoves(): FrameworkMoves | null {
  if (cached !== undefined) {
    return cached;
  }

  cached = loadFrameworkMovesFromDirectory(
    path.join(process.cwd(), "data", "framework"),
  );
  return cached;
}

export function getFrameworkMovesForGradeSpan(
  gradeSpan: GradeSpan,
): FrameworkLevelMoves | null {
  const moves = loadFrameworkMoves();
  return moves?.writing_moves[gradeSpan] ?? null;
}

export function resetFrameworkMovesCache(): void {
  cached = undefined;
}
