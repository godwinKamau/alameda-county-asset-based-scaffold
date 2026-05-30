import type { ElpacDomain, GradeSpan, PldGradeSpanKey } from "@/lib/types";

const ORAL_DOMAINS: ReadonlySet<ElpacDomain> = new Set(["listening", "speaking"]);

export function resolvePldGradeSpan(
  domain: ElpacDomain,
  gradeSpan: GradeSpan,
): PldGradeSpanKey {
  if (!ORAL_DOMAINS.has(domain)) return gradeSpan;
  return gradeSpan === "3-12" ? "3-12" : "K-2";
}
