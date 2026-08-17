import { z } from "zod";
import type { GradeSpan } from "@/lib/types";

export const ELPAC_DOMAINS = [
  "listening",
  "speaking",
  "reading",
  "writing",
] as const;

export const DomainSchema = z.enum(ELPAC_DOMAINS);
export type ElpacDomain = z.infer<typeof DomainSchema>;

export type PldSpanKey = "K" | "1-2" | "3-12" | "K-2";

export function mapGradeSpanToPldSpan(
  domain: ElpacDomain,
  gradeSpan: GradeSpan,
): PldSpanKey {
  if (domain === "listening" || domain === "speaking") {
    return gradeSpan === "K" || gradeSpan === "1-2" ? "K-2" : "3-12";
  }
  return gradeSpan;
}

export function domainSupportsWrittenArtifact(domain: ElpacDomain): boolean {
  return domain === "writing" || domain === "reading";
}

export function domainRequiresAudioWarning(domain: ElpacDomain): boolean {
  return domain === "listening" || domain === "speaking";
}

export function domainLabel(domain: ElpacDomain): string {
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export function emptyDomainLevels(): Record<ElpacDomain, number | null> {
  return Object.fromEntries(ELPAC_DOMAINS.map((d) => [d, null])) as Record<
    ElpacDomain,
    number | null
  >;
}
