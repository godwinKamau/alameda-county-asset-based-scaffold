import "server-only";

import { getPldsForDomainAndSpan } from "./loader";
import { getFrameworkMovesForGradeSpan } from "@/lib/framework/loader";
import { buildFrameworkBlockFromMoves } from "@/lib/framework/prompt-block";
import type { FrameworkMove } from "@/lib/framework/types";
import type { ElpacDomain } from "./domain";
import {
  domainLabel,
  domainRequiresAudioWarning,
} from "./domain";
import type { ExactGrade, GradeSpan } from "@/lib/types";

function formatLevelBlock(
  level: "1" | "2" | "3" | "4",
  data: { label: string; frequency_marker: string; descriptors: string[] },
): string {
  const bullets = data.descriptors.map((d) => `  - ${d}`).join("\n");
  return `Level ${level} — ${data.label} (${data.frequency_marker}):\n${bullets}`;
}

export interface SystemPromptResult {
  systemPrompt: string;
  citableMoves: FrameworkMove[];
}

export interface BuildSystemPromptOptions {
  excludeAnchors?: ReadonlySet<string>;
}

export function buildSystemPrompt(
  domain: ElpacDomain,
  gradeSpan: GradeSpan,
  exactGrade?: ExactGrade | null,
  options?: BuildSystemPromptOptions,
): SystemPromptResult {
  const plds = getPldsForDomainAndSpan(domain, gradeSpan);

  const injected = (["1", "2", "3", "4"] as const)
    .map((level) => formatLevelBlock(level, plds[level]))
    .join("\n\n");

  const calibrationSentence =
    exactGrade != null && gradeSpan === "3-12"
      ? `\nThe student is in grade ${exactGrade}. While the Range PLDs above apply across grades 3–12, calibrate your expectations for 'grade-appropriate' vocabulary, text complexity, sentence structure, and writing conventions specifically to grade ${exactGrade}. A grade 3 student and a grade 11 student share these descriptors but have very different grade-level benchmarks.\n`
      : "";

  const audioCaveat = domainRequiresAudioWarning(domain)
    ? `\nIMPORTANT: ${domainLabel(domain)} is normally assessed via audio on ELPAC. You are analyzing a written artifact only. Ground your analysis strictly in what the artifact evidences. If the artifact cannot support ${domainLabel(domain)} inferences, say so explicitly in level_reasoning.\n`
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

  const artifactType =
    domain === "writing" || domain === "reading"
      ? "writing artifacts"
      : "written artifacts (with limited evidence for this domain)";

  const systemPrompt = `You are an expert ELD (English Language Development) analyst trained in the
California ELPAC assessment framework. You analyze student ${artifactType}
and produce proficiency insights grounded in official ELPAC Range Performance
Level Descriptors (PLDs).

OFFICIAL ELPAC ${domainLabel(domain).toUpperCase()} RANGE PLDs FOR GRADE SPAN ${gradeSpan}:
${injected}
${calibrationSentence}${audioCaveat}${frameworkBlock}
ANALYSIS RULES:
- Lead with what the student CAN do. Frame every observation as an asset
  before naming a gap. Never use deficit language.
- Every strength you identify must map explicitly to a PLD descriptor above.
- The estimated_level must be an integer 1-4. Justify it with specific
  evidence from the artifact.
- The gap_to_next must name the specific descriptors from the NEXT level
  that are not yet consistently demonstrated.
- If estimated_level is 4, gap_to_next should acknowledge the student is at
  the highest level and suggest enrichment rather than a gap.
- The scaffold must be concrete (a teacher can use it tomorrow), culturally
  sustaining, and tied to the student's own writing — not a generic strategy.${scaffoldFrameworkClause}
  Format it as a numbered list (one move per line). Start each move with a
  **bold key teaching move**, then add supporting detail. Bold quoted language
  targets and sentence frames with ** as well.
- If multiple images are provided, treat them as pages of a single artifact.
  Ignore pages without student writing (covers, photos, prompts) and base your
  analysis on the writing pages only.
- If the artifact contains a student name, do not repeat it in your output.

RESPONSE FORMAT — call the submit_insight tool with these fields:
- strengths: 2-4 sentences, asset-based, PLD-grounded. Use **bold** to highlight
  PLD terminology and key descriptors the student demonstrates.
- estimated_level: integer 1-4
- level_reasoning: 2-3 sentences citing specific artifact evidence. Use **bold**
  for quoted or paraphrased evidence from the artifact and PLD-aligned terms.
- gap_to_next: 2-3 sentences naming specific next-level descriptors. Use **bold**
  for the next-level PLD descriptors not yet demonstrated.
- scaffold: 2 numbered lines like "1. **Key move** — detail with **quoted target**"${scaffoldSourceClause}`;

  return { systemPrompt, citableMoves };
}
