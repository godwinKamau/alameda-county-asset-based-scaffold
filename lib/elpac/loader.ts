import "server-only";

import fs from "fs";
import path from "path";
import { ElPacPldsSchema, type ElPacPlds } from "./types";

let cachedPlds: ElPacPlds | null = null;

export function loadElPacPlds(): ElPacPlds {
  if (cachedPlds) {
    return cachedPlds;
  }

  const filePath = path.join(process.cwd(), "data", "elpac_plds.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ELPAC PLD reference file not found at ${filePath}. Please supply data/elpac_plds.json.`,
    );
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const parsed = ElPacPldsSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(
      `Invalid elpac_plds.json structure: ${parsed.error.message}`,
    );
  }

  cachedPlds = parsed.data;
  return cachedPlds;
}

export function getWritingPldsForGradeSpan(
  gradeSpan: "K" | "1-2" | "3-12",
): ElPacPlds["range_plds"]["writing"][typeof gradeSpan] {
  const plds = loadElPacPlds();
  return plds.range_plds.writing[gradeSpan];
}
