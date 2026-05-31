import fs from "fs";
import path from "path";
import type { ElpacDomain, GradeSpan } from "@/lib/types";
import { resolvePldGradeSpan } from "./grade-span";
import { ElPacPldsSchema, type ElPacPlds, type PldLevelSet } from "./types";

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

export function getRangePlds(
  domain: ElpacDomain,
  gradeSpan: GradeSpan,
): PldLevelSet {
  const plds = loadElPacPlds();
  const key = resolvePldGradeSpan(domain, gradeSpan);
  const domainPlds = plds.range_plds[domain];

  const levelSet = (domainPlds as unknown as Record<string, PldLevelSet>)[key];
  if (!levelSet) {
    throw new Error(
      `No ${domain} Range PLDs for grade span "${key}" (from roster span "${gradeSpan}").`,
    );
  }
  return levelSet;
}

export function getWritingPldsForGradeSpan(
  gradeSpan: GradeSpan,
): PldLevelSet {
  return getRangePlds("writing", gradeSpan);
}
