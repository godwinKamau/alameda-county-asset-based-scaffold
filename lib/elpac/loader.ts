import "server-only";

import fs from "fs";
import path from "path";
import type { ElpacDomain } from "./domain";
import { mapGradeSpanToPldSpan } from "./domain";
import { ElPacPldsSchema, type ElPacPlds, type GeneralPlds, type PldLevel } from "./types";
import type { GradeSpan } from "@/lib/types";

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
  gradeSpan: GradeSpan,
): Record<"1" | "2" | "3" | "4", PldLevel> {
  return getPldsForDomainAndSpan("writing", gradeSpan);
}

export function getPldsForDomainAndSpan(
  domain: ElpacDomain,
  gradeSpan: GradeSpan,
): Record<"1" | "2" | "3" | "4", PldLevel> {
  const plds = loadElPacPlds();
  const spanKey = mapGradeSpanToPldSpan(domain, gradeSpan);
  const domainBlock = plds.range_plds[domain] as Record<
    string,
    Record<"1" | "2" | "3" | "4", PldLevel>
  >;
  const spanPlds = domainBlock[spanKey];
  if (!spanPlds) {
    throw new Error(`No PLDs for domain ${domain} span ${spanKey}`);
  }
  return spanPlds;
}

export function getGeneralPlds(): GeneralPlds {
  const plds = loadElPacPlds();
  if (!plds.general_plds) {
    throw new Error("elpac_plds.json is missing general_plds");
  }
  return plds.general_plds;
}
