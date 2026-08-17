import "server-only";

import { getGeneralPlds, getPldsForDomainAndSpan } from "./loader";
import { getFrameworkMovesForGradeSpan } from "@/lib/framework/loader";
import { buildFrameworkBlockFromMoves } from "@/lib/framework/prompt-block";
import type { FrameworkMove } from "@/lib/framework/types";
import type { ElpacDomain } from "./domain";
import { domainLabel } from "./domain";
import type { EvidenceKind } from "./evidence";
import { evidenceKindNoun } from "./evidence";
import type { ExactGrade, GradeSpan } from "@/lib/types";

const DOMAIN_CALIBRATION: Record<ElpacDomain, string> = {
  writing:
    "vocabulary, text complexity, sentence structure, and writing conventions",
  reading: "text complexity, vocabulary range, and inference demand",
  speaking:
    "vocabulary, sentence structure, discourse length, and expectations for sustained academic talk",
  listening:
    "vocabulary, syntactic complexity, and discourse length of the material the student listened to",
};

const EVIDENCE_RULES: Record<EvidenceKind, string> = {
  written_artifact: `- If multiple images are provided, treat them as pages of a single artifact.
  Ignore pages without student writing (covers, photos, prompts) and base your
  analysis on the writing pages only.
- If the artifact contains a student name, do not repeat it in your output.`,
  audio_recording: `- The transcript is machine-generated and teacher-corrected. Do NOT treat
  transcription artifacts as student language errors.
- Delivery metrics below are measured signals of fluency and hesitation only —
  NOT pronunciation or intonation. Where a PLD descriptor bundles delivery with
  other constructs, judge only the fluency half and say so in level_reasoning.
- If the transcript contains a student name, do not repeat it in your output.`,
  observation_protocol: `- The estimated level has already been determined from the teacher's
  observation checklist. Do NOT restate or override it. Explain and scaffold from
  the checked descriptors.`,
  administered_task: `- Score strictly against the administered task responses provided.`,
};

function formatLevelBlock(
  level: "1" | "2" | "3" | "4",
  data: { label: string; frequency_marker: string; descriptors: string[] },
): string {
  const bullets = data.descriptors.map((d) => `  - ${d}`).join("\n");
  return `Level ${level} — ${data.label} (${data.frequency_marker}):\n${bullets}`;
}

function formatGeneralPldsBlock(): string {
  const general = getGeneralPlds();
  const lines = (["1", "2", "3", "4"] as const).map((level) => {
    const data = general.levels[level];
    return `Level ${level} (${data.label}): ${data.summary}`;
  });
  return `GENERAL ELPAC PROFICIENCY FRAMING (cross-domain context):\n${lines.join("\n")}\n`;
}

export interface SystemPromptResult {
  systemPrompt: string;
  citableMoves: FrameworkMove[];
}

export interface BuildSystemPromptOptions {
  excludeAnchors?: ReadonlySet<string>;
  /** When set, the model must not assign a level (observation protocol). */
  derivedLevel?: number;
}

export function buildSystemPrompt(
  domain: ElpacDomain,
  evidenceKind: EvidenceKind,
  gradeSpan: GradeSpan,
  exactGrade?: ExactGrade | null,
  options?: BuildSystemPromptOptions,
): SystemPromptResult {
  const plds = getPldsForDomainAndSpan(domain, gradeSpan);

  const injected = (["1", "2", "3", "4"] as const)
    .map((level) => formatLevelBlock(level, plds[level]))
    .join("\n\n");

  const calibrationFocus = DOMAIN_CALIBRATION[domain];

  const calibrationSentence =
    exactGrade != null && gradeSpan === "3-12"
      ? `\nThe student is in grade ${exactGrade}. While the Range PLDs above apply across grades 3–12, calibrate your expectations for grade-appropriate ${calibrationFocus} specifically to grade ${exactGrade}. A grade 3 student and a grade 11 student share these descriptors but have very different grade-level benchmarks.\n`
      : "";

  const k2AudioCaveat =
    evidenceKind === "audio_recording" &&
    domain === "speaking" &&
    (gradeSpan === "K" || gradeSpan === "1-2")
      ? `\nIMPORTANT: Transcription reliability is materially lower for K–2 speakers. Weight lexical and discourse evidence over patterns that may reflect ASR errors.\n`
      : "";

  const { block: frameworkBlock, citableMoves } = buildFrameworkBlockFromMoves(
    getFrameworkMovesForGradeSpan(gradeSpan),
    gradeSpan,
    exactGrade,
    options?.excludeAnchors?.size
      ? { excludeAnchors: options.excludeAnchors }
      : undefined,
  );

  const scaffoldFrameworkClause = frameworkBlock
    ? " When framework moves are provided above, base each scaffold step on one and\n  name its ELD mode (integrated/designated)."
    : "";

  const scaffoldSourceClause = citableMoves.length
    ? "\n- In scaffold_source_ids, list the [F#] id(s) of the framework move(s) you\n  based the scaffold on. Use only ids shown in the suggested moves above."
    : "";

  const evidenceNoun = evidenceKindNoun(evidenceKind);

  const levelRule =
    options?.derivedLevel != null
      ? `- The estimated level is ${options.derivedLevel} (determined from the observation protocol). Do NOT change it.`
      : `- The estimated_level must be an integer 1-4. Justify it with specific evidence from the ${evidenceNoun}.`;

  const evidenceRulesBlock = EVIDENCE_RULES[evidenceKind];

  const generalBlock = formatGeneralPldsBlock();

  const systemPrompt = `You are an expert ELD (English Language Development) analyst trained in the
California ELPAC assessment framework. You analyze student evidence from ${evidenceNoun}
and produce proficiency insights grounded in official ELPAC Range Performance
Level Descriptors (PLDs).

${generalBlock}
OFFICIAL ELPAC ${domainLabel(domain).toUpperCase()} RANGE PLDs FOR GRADE SPAN ${gradeSpan}:
${injected}
${calibrationSentence}${k2AudioCaveat}${frameworkBlock}
ANALYSIS RULES:
- Lead with what the student CAN do. Frame every observation as an asset
  before naming a gap. Never use deficit language.
- Every strength you identify must map explicitly to a PLD descriptor above.
${levelRule}
- The gap_to_next must name the specific descriptors from the NEXT level
  that are not yet consistently demonstrated.
- If estimated_level is 4, gap_to_next should acknowledge the student is at
  the highest level and suggest enrichment rather than a gap.
- The scaffold must be concrete (a teacher can use it tomorrow), culturally
  sustaining, and tied to the student's own language production in the ${evidenceNoun} — not a generic strategy.${scaffoldFrameworkClause}
  Format it as a numbered list (one move per line). Start each move with a
  **bold key teaching move**, then add supporting detail. Bold quoted language
  targets and sentence frames with ** as well.
${evidenceRulesBlock}

RESPONSE FORMAT — call the submit_insight tool with these fields:
- strengths: 2-4 sentences, asset-based, PLD-grounded. Use **bold** to highlight
  PLD terminology and key descriptors the student demonstrates.
- estimated_level: integer 1-4
- level_reasoning: 2-3 sentences citing specific evidence. Use **bold**
  for quoted or paraphrased evidence and PLD-aligned terms.
- gap_to_next: 2-3 sentences naming specific next-level descriptors. Use **bold**
  for the next-level PLD descriptors not yet demonstrated.
- scaffold: 2 numbered lines like "1. **Key move** — detail with **quoted target**"${scaffoldSourceClause}`;

  return { systemPrompt, citableMoves };
}
