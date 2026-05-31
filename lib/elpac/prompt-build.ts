import { getFrameworkMovesForGradeSpan } from "@/lib/framework/loader";
import { buildFrameworkBlockFromMoves } from "@/lib/framework/prompt-block";
import { getRangePlds } from "./loader";
import { resolvePldGradeSpan } from "./grade-span";
import type { ElpacDomain, ExactGrade, GradeSpan } from "@/lib/types";
import type { PldLevelSet } from "./types";

function formatLevelBlock(
  level: "1" | "2" | "3" | "4",
  data: { label: string; frequency_marker: string; descriptors: string[] },
): string {
  const bullets = data.descriptors.map((d) => `  - ${d}`).join("\n");
  return `Level ${level} — ${data.label} (${data.frequency_marker}):\n${bullets}`;
}

interface DomainConfig {
  analystDescription: string;
  pldHeader: string;
  calibrationText: (grade: string) => string;
  scaffoldAnchor: string;
  artifactRules: string;
}

const DOMAIN_CONFIG: Record<ElpacDomain, DomainConfig> = {
  writing: {
    analystDescription:
      "You analyze student writing artifacts and produce proficiency insights\n" +
      "grounded in official ELPAC Range Performance Level Descriptors (PLDs).",
    pldHeader: "OFFICIAL ELPAC WRITING RANGE PLDs FOR GRADE SPAN",
    calibrationText: (grade) =>
      `The student is in grade ${grade}. While the Range PLDs above apply across ` +
      `grades 3–12, calibrate your expectations for 'grade-appropriate' vocabulary, ` +
      `text complexity, sentence structure, and writing conventions specifically to ` +
      `grade ${grade}. A grade 3 student and a grade 11 student share these descriptors ` +
      `but have very different grade-level benchmarks.`,
    scaffoldAnchor:
      "tied to the student's own writing — not a generic strategy",
    artifactRules:
      "- If multiple images are provided, treat them as pages of a single artifact.\n" +
      "  Ignore pages without student writing (covers, photos, prompts) and base your\n" +
      "  analysis on the writing pages only.\n" +
      "- If the artifact contains a student name, do not repeat it in your output.",
  },

  reading: {
    analystDescription:
      "You analyze evidence of student reading comprehension — written reading\n" +
      "responses, annotations, graphic organizers, or completed reading worksheets —\n" +
      "and produce proficiency insights grounded in official ELPAC Range Performance\n" +
      "Level Descriptors (PLDs).",
    pldHeader: "OFFICIAL ELPAC READING RANGE PLDs FOR GRADE SPAN",
    calibrationText: (grade) =>
      `The student is in grade ${grade}. While the Range PLDs above apply across ` +
      `grades 3–12, calibrate your expectations for 'grade-appropriate' text complexity, ` +
      `comprehension depth, vocabulary use, and inference-making specifically to ` +
      `grade ${grade}.`,
    scaffoldAnchor:
      "tied to the specific reading behaviors the student demonstrated in this response — not a generic strategy",
    artifactRules:
      "- All pages of the artifact should be treated as reading evidence.\n" +
      "  Do not ignore any pages — a prompt page paired with a response page both\n" +
      "  provide context for the student's comprehension.\n" +
      "- If the artifact contains a student name, do not repeat it in your output.",
  },

  speaking: {
    analystDescription:
      "You analyze a written or scored record of a student's spoken output — such\n" +
      "as a teacher's observational notes, a speaking rubric, or a transcription —\n" +
      "and produce proficiency insights grounded in official ELPAC Range Performance\n" +
      "Level Descriptors (PLDs). You are assessing the student's oral language production,\n" +
      "not their writing.",
    pldHeader: "OFFICIAL ELPAC SPEAKING RANGE PLDs FOR GRADE SPAN",
    calibrationText: (grade) =>
      `The student is in grade ${grade}. Calibrate your expectations for ` +
      `'grade-appropriate' vocabulary range, grammatical complexity, discourse ` +
      `organization, and conversational fluency specifically to grade ${grade}.`,
    scaffoldAnchor:
      "tied to the specific speech patterns and language the student produced — not a generic strategy",
    artifactRules:
      "- The artifact represents the student's spoken output, not their writing ability.\n" +
      "  Base your analysis entirely on the oral language evidence provided.\n" +
      "- If the artifact contains a student name, do not repeat it in your output.",
  },

  listening: {
    analystDescription:
      "You analyze written evidence of a student's listening comprehension — such as\n" +
      "a completed listening-response worksheet, observational notes, or a scored\n" +
      "listening rubric — and produce proficiency insights grounded in official ELPAC\n" +
      "Range Performance Level Descriptors (PLDs). You are assessing the student's\n" +
      "receptive oral language skills, not their writing.",
    pldHeader: "OFFICIAL ELPAC LISTENING RANGE PLDs FOR GRADE SPAN",
    calibrationText: (grade) =>
      `The student is in grade ${grade}. Calibrate your expectations for ` +
      `'grade-appropriate' comprehension depth, inference-making, and ability to ` +
      `follow academic discourse specifically to grade ${grade}.`,
    scaffoldAnchor:
      "tied to the specific comprehension patterns the student demonstrated — not a generic strategy",
    artifactRules:
      "- The artifact represents the student's receptive comprehension, not their\n" +
      "  writing or speaking ability. Anchor every observation in the listening\n" +
      "  evidence provided.\n" +
      "- If the artifact contains a student name, do not repeat it in your output.",
  },
};

function formatPldBlock(plds: PldLevelSet): string {
  return (["1", "2", "3", "4"] as const)
    .map((level) => formatLevelBlock(level, plds[level]))
    .join("\n\n");
}

export function buildSystemPrompt(
  domain: ElpacDomain,
  gradeSpan: GradeSpan,
  exactGrade?: ExactGrade | null,
): string {
  const config = DOMAIN_CONFIG[domain];
  const plds = getRangePlds(domain, gradeSpan);
  const resolvedSpan = resolvePldGradeSpan(domain, gradeSpan);
  const injected = formatPldBlock(plds);

  const shouldCalibrate =
    exactGrade != null &&
    (resolvedSpan === "3-12" || resolvedSpan === "K-2");

  const calibrationSentence = shouldCalibrate
    ? `\n${config.calibrationText(exactGrade!)}\n`
    : "";

  const frameworkBlock =
    domain === "writing"
      ? buildFrameworkBlockFromMoves(
          getFrameworkMovesForGradeSpan(gradeSpan),
          gradeSpan,
          exactGrade,
        )
      : "";

  const scaffoldFrameworkClause = frameworkBlock
    ? " When framework moves are provided above, base each scaffold step on one and\n  name its ELD mode (integrated/designated)."
    : "";

  return `You are an expert ELD (English Language Development) analyst trained in the
California ELPAC assessment framework. ${config.analystDescription}

${config.pldHeader} ${resolvedSpan}:
${injected}
${calibrationSentence}${frameworkBlock}
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
  sustaining, and ${config.scaffoldAnchor}.${scaffoldFrameworkClause}
  Format it as a numbered list (one move per line). Start each move with a
  **bold key teaching move**, then add supporting detail. Bold quoted language
  targets and sentence frames with ** as well.
${config.artifactRules}

RESPONSE FORMAT — call the submit_insight tool with these fields:
- strengths: 2-4 sentences, asset-based, PLD-grounded
- estimated_level: integer 1-4
- level_reasoning: 2-3 sentences citing specific artifact evidence
- gap_to_next: 2-3 sentences naming specific next-level descriptors
- scaffold: 2 numbered lines like "1. **Key move** — detail with **quoted target**"`;
}
