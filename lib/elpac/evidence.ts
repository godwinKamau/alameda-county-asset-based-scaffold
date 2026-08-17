import { z } from "zod";
import type { ElpacDomain } from "./domain";
import type { GradeSpan } from "@/lib/types";

export const EVIDENCE_KINDS = [
  "written_artifact",
  "audio_recording",
  "observation_protocol",
  "administered_task",
] as const;

export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export type EvidenceValidity = "primary" | "supporting" | "invalid";

/** Evidence kinds selectable in the analyze UI (administered_task reserved). */
export const SELECTABLE_EVIDENCE_KINDS: readonly EvidenceKind[] = [
  "written_artifact",
  "audio_recording",
  "observation_protocol",
];

export const EVIDENCE_VALIDITY: Record<
  ElpacDomain,
  Record<EvidenceKind, EvidenceValidity>
> = {
  writing: {
    written_artifact: "primary",
    audio_recording: "invalid",
    observation_protocol: "supporting",
    administered_task: "supporting",
  },
  reading: {
    written_artifact: "primary",
    audio_recording: "supporting",
    observation_protocol: "supporting",
    administered_task: "supporting",
  },
  speaking: {
    written_artifact: "invalid",
    audio_recording: "primary",
    observation_protocol: "supporting",
    administered_task: "supporting",
  },
  listening: {
    written_artifact: "invalid",
    audio_recording: "invalid",
    observation_protocol: "primary",
    administered_task: "primary",
  },
};

export function evidenceValidity(
  domain: ElpacDomain,
  kind: EvidenceKind,
): EvidenceValidity {
  return EVIDENCE_VALIDITY[domain][kind];
}

export function isValidEvidence(domain: ElpacDomain, kind: EvidenceKind): boolean {
  return evidenceValidity(domain, kind) !== "invalid";
}

export function primaryEvidenceKinds(domain: ElpacDomain): EvidenceKind[] {
  return EVIDENCE_KINDS.filter(
    (kind) => EVIDENCE_VALIDITY[domain][kind] === "primary",
  );
}

export function selectableEvidenceKinds(domain: ElpacDomain): EvidenceKind[] {
  return SELECTABLE_EVIDENCE_KINDS.filter((kind) =>
    isValidEvidence(domain, kind),
  );
}

export function evidenceKindLabel(kind: EvidenceKind): string {
  switch (kind) {
    case "written_artifact":
      return "Written artifact";
    case "audio_recording":
      return "Audio recording";
    case "observation_protocol":
      return "Observation protocol";
    case "administered_task":
      return "Administered task";
  }
}

export function evidenceKindNoun(kind: EvidenceKind): string {
  switch (kind) {
    case "written_artifact":
      return "written artifact";
    case "audio_recording":
      return "audio recording of the student speaking";
    case "observation_protocol":
      return "structured classroom observation";
    case "administered_task":
      return "administered task";
  }
}

export function recommendedEvidenceKind(
  domain: ElpacDomain,
  gradeSpan: GradeSpan,
): EvidenceKind {
  if (
    domain === "speaking" &&
    (gradeSpan === "K" || gradeSpan === "1-2")
  ) {
    return "observation_protocol";
  }

  const primary = primaryEvidenceKinds(domain);
  if (primary.length === 1) {
    return primary[0];
  }

  if (domain === "listening") {
    return "observation_protocol";
  }

  return "written_artifact";
}

/** Generate the NOT (...) clauses for the domain x evidence CHECK constraint. */
export function buildDomainEvidenceCheckSql(): string {
  const clauses: string[] = [];
  for (const domain of Object.keys(EVIDENCE_VALIDITY) as ElpacDomain[]) {
    for (const kind of EVIDENCE_KINDS) {
      if (EVIDENCE_VALIDITY[domain][kind] === "invalid") {
        clauses.push(
          `NOT (domain = '${domain}' AND evidence_kind = '${kind}')`,
        );
      }
    }
  }
  return clauses.join("\n    AND ");
}

export function invalidEvidencePairs(): { domain: ElpacDomain; kind: EvidenceKind }[] {
  const pairs: { domain: ElpacDomain; kind: EvidenceKind }[] = [];
  for (const domain of Object.keys(EVIDENCE_VALIDITY) as ElpacDomain[]) {
    for (const kind of EVIDENCE_KINDS) {
      if (EVIDENCE_VALIDITY[domain][kind] === "invalid") {
        pairs.push({ domain, kind });
      }
    }
  }
  return pairs;
}
