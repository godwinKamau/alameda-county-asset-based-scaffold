import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/elpac/prompt";
import {
  formatScaffoldSourceLabel,
  resolveScaffoldSourcesFromIds,
} from "@/lib/framework/sources";
import {
  InsightSchema,
  InsightToolSchema,
  RemixScaffoldToolSchema,
  type ExactGrade,
  type GradeSpan,
  type Insight,
  type RemixScaffoldResult,
  type ScaffoldSource,
} from "@/lib/types";

const MODEL = "claude-sonnet-4-6";
const INSIGHT_TOOL_NAME = "submit_insight";
const REMIX_TOOL_NAME = "submit_scaffold";
const REMIX_ITEM_TOOL_NAME = "submit_scaffold_item";

const INSIGHT_TOOL: Anthropic.Tool = {
  name: INSIGHT_TOOL_NAME,
  description: "Submit the ELPAC writing analysis insight.",
  input_schema: {
    type: "object",
    properties: {
      strengths: {
        type: "string",
        description:
          "2-4 sentences, asset-based, PLD-grounded strengths the student demonstrates.",
      },
      estimated_level: {
        type: "integer",
        minimum: 1,
        maximum: 4,
        description: "Estimated ELPAC writing level (1-4).",
      },
      level_reasoning: {
        type: "string",
        description:
          "2-3 sentences citing specific artifact evidence for the estimated level.",
      },
      gap_to_next: {
        type: "string",
        description:
          "2-3 sentences naming specific next-level descriptors not yet demonstrated.",
      },
      scaffold: {
        type: "string",
        description:
          "2 numbered scaffold moves. Start each with a bold key teaching move, then supporting detail.",
      },
      scaffold_source_ids: {
        type: "array",
        items: { type: "integer", minimum: 1 },
        description:
          "The [F#] id(s) of framework move(s) the scaffold is based on, from the suggested moves list.",
      },
    },
    required: [
      "strengths",
      "estimated_level",
      "level_reasoning",
      "gap_to_next",
      "scaffold",
    ],
  },
};

const REMIX_TOOL: Anthropic.Tool = {
  name: REMIX_TOOL_NAME,
  description: "Submit a remixed asset-based scaffold.",
  input_schema: {
    type: "object",
    properties: {
      scaffold: {
        type: "string",
        description:
          "2 numbered scaffold moves. Start each with a bold key teaching move, then supporting detail.",
      },
      scaffold_source_ids: {
        type: "array",
        items: { type: "integer", minimum: 1 },
        description:
          "The [F#] id(s) of framework move(s) the scaffold is based on, from the suggested moves list.",
      },
    },
    required: ["scaffold"],
  },
};

const REMIX_ITEM_TOOL: Anthropic.Tool = {
  name: REMIX_ITEM_TOOL_NAME,
  description: "Submit a remixed single scaffold move.",
  input_schema: {
    type: "object",
    properties: {
      scaffold: {
        type: "string",
        description:
          "One scaffold move. Start with a bold key teaching move, then supporting detail. Do not include a number prefix.",
      },
      scaffold_source_ids: {
        type: "array",
        items: { type: "integer", minimum: 1 },
        description:
          "The [F#] id(s) of framework move(s) the scaffold move is based on, from the suggested moves list.",
      },
    },
    required: ["scaffold"],
  },
};

export class ClaudeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeParseError";
  }
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey });
}

export interface AnalyzeArtifactImage {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export interface AnalyzeArtifactInput {
  images: AnalyzeArtifactImage[];
  gradeSpan: GradeSpan;
  exactGrade?: ExactGrade | null;
  providedLevel?: number | null;
}

export async function analyzeArtifact(
  input: AnalyzeArtifactInput,
): Promise<Insight> {
  if (input.images.length === 0) {
    throw new ClaudeParseError("At least one image is required");
  }

  const client = getClient();
  const { systemPrompt, citableMoves } = buildSystemPrompt(
    input.gradeSpan,
    input.exactGrade,
  );

  const contextParts: string[] = [`Grade span: ${input.gradeSpan}`];
  if (input.providedLevel != null) {
    contextParts.push(`Teacher-provided ELPAC level: ${input.providedLevel}`);
  }

  if (input.images.length > 1) {
    contextParts.unshift(
      `The following ${input.images.length} images are pages of one student artifact, in order. Some pages may be unrelated (prompts, photos, cover art). Analyze ONLY the page(s) containing student handwriting.`,
    );
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 0.2,
    system: systemPrompt,
    tools: [INSIGHT_TOOL],
    tool_choice: { type: "tool", name: INSIGHT_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          ...input.images.map((image) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: image.mediaType,
              data: image.imageBase64,
            },
          })),
          {
            type: "text" as const,
            text: contextParts.join("\n"),
          },
        ],
      },
    ],
  });

  const toolBlock = response.content.find((block) => block.type === "tool_use");

  if (!toolBlock || toolBlock.type !== "tool_use") {
    console.error("[claude] No tool_use block in response");
    throw new ClaudeParseError("Analysis response was empty");
  }

  if (toolBlock.name !== INSIGHT_TOOL_NAME) {
    console.error("[claude] Unexpected tool name in response");
    throw new ClaudeParseError("Analysis response used an unexpected tool");
  }

  const parsed: unknown = toolBlock.input;

  const validated = InsightToolSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[claude] Insight schema validation failed");
    throw new ClaudeParseError("Analysis response did not match expected format");
  }

  const { scaffold_source_ids, ...insightFields } = validated.data;
  const scaffoldSources = resolveScaffoldSourcesFromIds(
    scaffold_source_ids,
    citableMoves,
  );

  const insightPayload = {
    ...insightFields,
    ...(scaffoldSources.length > 0 ? { scaffold_sources: scaffoldSources } : {}),
  };

  const insightValidated = InsightSchema.safeParse(insightPayload);
  if (!insightValidated.success) {
    console.error("[claude] Insight schema validation failed after resolution");
    throw new ClaudeParseError("Analysis response did not match expected format");
  }

  return insightValidated.data;
}

export interface RemixScaffoldInput {
  gradeSpan: GradeSpan;
  exactGrade?: ExactGrade | null;
  estimatedLevel: number;
  strengths: string;
  levelReasoning: string;
  gapToNext: string;
  originalScaffold: string;
  originalSources?: ScaffoldSource[];
}

export interface RemixItemInput extends RemixScaffoldInput {
  originalItem: string;
  originalItemSources?: ScaffoldSource[];
}

function formatOriginalSources(sources: ScaffoldSource[] | undefined): string {
  if (!sources?.length) {
    return "(none cited)";
  }
  return sources
    .map((source) => `- ${formatScaffoldSourceLabel(source)}`)
    .join("\n");
}

export async function remixScaffold(
  input: RemixScaffoldInput,
): Promise<RemixScaffoldResult> {
  const client = getClient();
  const { systemPrompt, citableMoves } = buildSystemPrompt(
    input.gradeSpan,
    input.exactGrade,
  );

  const userMessage = `ORIGINAL ANALYSIS CONTEXT (do not regenerate these fields):
- Estimated ELPAC level: ${input.estimatedLevel}
- Observed strengths: ${input.strengths}
- Level reasoning: ${input.levelReasoning}
- Gap to next level: ${input.gapToNext}

ORIGINAL ASSET-BASED SCAFFOLD:
${input.originalScaffold}

ORIGINAL SCAFFOLD FRAMEWORK SOURCES:
${formatOriginalSources(input.originalSources)}

REMIX TASK:
Produce a NEW asset-based scaffold that targets the SAME proficiency gap and
estimated level as the original analysis, but with different teaching moves,
wording, and examples. Do NOT copy the original scaffold verbatim.
- Keep exactly 2 numbered moves in the same format as the original.
- Start each move with a **bold key teaching move**, then supporting detail.
- Bold quoted language targets and sentence frames with ** as well.
- Base each move on a framework [F#] move from the suggested moves above and
  name its ELD mode (integrated/designated) where relevant.
- The scaffold must remain concrete, culturally sustaining, and tied to the
  student's strengths and gap described above — not a generic strategy.
- In scaffold_source_ids, list the [F#] id(s) you used. Use only ids shown above.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    temperature: 0.7,
    system: systemPrompt,
    tools: [REMIX_TOOL],
    tool_choice: { type: "tool", name: REMIX_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userMessage }],
      },
    ],
  });

  const toolBlock = response.content.find((block) => block.type === "tool_use");

  if (!toolBlock || toolBlock.type !== "tool_use") {
    console.error("[claude] No tool_use block in remix response");
    throw new ClaudeParseError("Remix response was empty");
  }

  if (toolBlock.name !== REMIX_TOOL_NAME) {
    console.error("[claude] Unexpected tool name in remix response");
    throw new ClaudeParseError("Remix response used an unexpected tool");
  }

  const parsed: unknown = toolBlock.input;

  const validated = RemixScaffoldToolSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[claude] Remix schema validation failed");
    throw new ClaudeParseError("Remix response did not match expected format");
  }

  const { scaffold_source_ids, scaffold } = validated.data;
  const scaffoldSources = resolveScaffoldSourcesFromIds(
    scaffold_source_ids,
    citableMoves,
  );

  return {
    scaffold,
    ...(scaffoldSources.length > 0 ? { scaffold_sources: scaffoldSources } : {}),
  };
}

export async function remixScaffoldItem(
  input: RemixItemInput,
): Promise<RemixScaffoldResult> {
  const client = getClient();
  const { systemPrompt, citableMoves } = buildSystemPrompt(
    input.gradeSpan,
    input.exactGrade,
  );

  const userMessage = `ORIGINAL ANALYSIS CONTEXT (do not regenerate these fields):
- Estimated ELPAC level: ${input.estimatedLevel}
- Observed strengths: ${input.strengths}
- Level reasoning: ${input.levelReasoning}
- Gap to next level: ${input.gapToNext}

FULL ORIGINAL ASSET-BASED SCAFFOLD (for context only):
${input.originalScaffold}

ORIGINAL SCAFFOLD ITEM TO REMIX:
${input.originalItem}

ORIGINAL ITEM FRAMEWORK SOURCES:
${formatOriginalSources(input.originalItemSources)}

REMIX TASK:
Produce a NEW single scaffold move that targets the SAME proficiency gap and
estimated level as the original analysis, but with a different teaching move,
wording, and examples than the original item above. Do NOT copy the original
item verbatim.
- Return ONE move only (no numbering prefix).
- Start with a **bold key teaching move**, then supporting detail.
- Bold quoted language targets and sentence frames with ** as well.
- Base the move on a framework [F#] move from the suggested moves above and
  name its ELD mode (integrated/designated) where relevant.
- The move must remain concrete, culturally sustaining, and tied to the
  student's strengths and gap described above — not a generic strategy.
- In scaffold_source_ids, list the [F#] id(s) you used. Use only ids shown above.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.7,
    system: systemPrompt,
    tools: [REMIX_ITEM_TOOL],
    tool_choice: { type: "tool", name: REMIX_ITEM_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userMessage }],
      },
    ],
  });

  const toolBlock = response.content.find((block) => block.type === "tool_use");

  if (!toolBlock || toolBlock.type !== "tool_use") {
    console.error("[claude] No tool_use block in remix item response");
    throw new ClaudeParseError("Remix response was empty");
  }

  if (toolBlock.name !== REMIX_ITEM_TOOL_NAME) {
    console.error("[claude] Unexpected tool name in remix item response");
    throw new ClaudeParseError("Remix response used an unexpected tool");
  }

  const parsed: unknown = toolBlock.input;

  const validated = RemixScaffoldToolSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[claude] Remix item schema validation failed");
    throw new ClaudeParseError("Remix response did not match expected format");
  }

  const { scaffold_source_ids, scaffold } = validated.data;
  const scaffoldSources = resolveScaffoldSourcesFromIds(
    scaffold_source_ids,
    citableMoves,
  );

  return {
    scaffold,
    ...(scaffoldSources.length > 0 ? { scaffold_sources: scaffoldSources } : {}),
  };
}
