import fs from "fs";
import path from "path";
import { mergeFrameworkGradeSpans } from "./merge";
import { FrameworkMovesSchema, type FrameworkMoves } from "./types";

export function loadFrameworkMovesFromDirectory(
  dir: string,
): FrameworkMoves | null {
  if (!fs.existsSync(dir)) {
    return null;
  }

  const merged: FrameworkMoves = { writing_moves: {} };
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const raw = JSON.parse(
      fs.readFileSync(path.join(dir, file), "utf8"),
    ) as unknown;
    const parsed = FrameworkMovesSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid ${file}: ${parsed.error.message}`);
    }

    mergeFrameworkGradeSpans(merged.writing_moves, parsed.data.writing_moves);
  }

  return merged;
}
