import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { traceable, getCurrentRunTree } from "langsmith/traceable";
import type { ElpacDomain } from "@/lib/elpac/domain";
import { buildSystemPrompt } from "@/lib/elpac/prompt";
import {
  attachUsage,
  CLAUDE_MODEL,
  describeImages,
  extractUserTextFromAnthropicParams,
  MODEL_METADATA,
} from "@/lib/langsmith/tracer";
import {
  formatScaffoldSourceLabel,
  getScaffoldSourceAnchors,
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

const MODEL = CLAUDE_MODEL;
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
  domain: ElpacDomain;
  gradeSpan: GradeSpan;
  exactGrade?: ExactGrade | null;
  providedLevel?: number | null;
}

export interface AnalyzeArtifactStreamOptions {
  onSnapshot?: (snapshot: Partial<Insight>) => void;
}

function buildAnalyzeArtifactRequest(input: AnalyzeArtifactInput) {
  if (input.images.length === 0) {
    throw new ClaudeParseError("At least one image is required");
  }

  const { systemPrompt, citableMoves } = buildSystemPrompt(
    input.domain,
    input.gradeSpan,
    input.exactGrade,
  );

  const contextParts: string[] = [
    `Domain: ${input.domain}`,
    `Grade span: ${input.gradeSpan}`,
  ];
  if (input.providedLevel != null) {
    contextParts.push(`Teacher-provided ELPAC level: ${input.providedLevel}`);
  }

  if (input.images.length > 1) {
    contextParts.unshift(
      `The following ${input.images.length} images are pages of one student artifact, in order. Some pages may be unrelated (prompts, photos, cover art). Analyze ONLY the page(s) containing student handwriting.`,
    );
  }

  return {
    citableMoves,
    params: {
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.2,
      system: systemPrompt,
      tools: [INSIGHT_TOOL],
      tool_choice: { type: "tool" as const, name: INSIGHT_TOOL_NAME },
      messages: [
        {
          role: "user" as const,
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
    },
  };
}

function parseInsightToolResponse(
  response: Anthropic.Message,
  citableMoves: ReturnType<typeof buildSystemPrompt>["citableMoves"],
): Insight {
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

function snapshotToPartialInsight(snapshot: unknown): Partial<Insight> {
  if (!snapshot || typeof snapshot !== "object") {
    return {};
  }

  const record = snapshot as Record<string, unknown>;
  const partial: Partial<Insight> = {};

  if (typeof record.strengths === "string") {
    partial.strengths = record.strengths;
  }
  if (
    typeof record.estimated_level === "number" &&
    Number.isInteger(record.estimated_level) &&
    record.estimated_level >= 1 &&
    record.estimated_level <= 4
  ) {
    partial.estimated_level = record.estimated_level;
  }
  if (typeof record.level_reasoning === "string") {
    partial.level_reasoning = record.level_reasoning;
  }
  if (typeof record.gap_to_next === "string") {
    partial.gap_to_next = record.gap_to_next;
  }
  if (typeof record.scaffold === "string") {
    partial.scaffold = record.scaffold;
  }

  return partial;
}

async function analyzeArtifactStreamImpl(
  input: AnalyzeArtifactInput,
  options: AnalyzeArtifactStreamOptions = {},
): Promise<Insight> {
  const runTree = getCurrentRunTree(true);
  if (runTree) {
    runTree.metadata = {
      ...runTree.metadata,
      image_count: input.images.length,
    };
  }

  const client = getClient();
  const { citableMoves, params } = buildAnalyzeArtifactRequest(input);
  const stream = client.messages.stream(params);

  stream.on("inputJson", (_partialJson, snapshot) => {
    options.onSnapshot?.(snapshotToPartialInsight(snapshot));
  });

  const response = await stream.finalMessage();
  attachUsage(response);
  return parseInsightToolResponse(response, citableMoves);
}

export const analyzeArtifactStream = traceable(analyzeArtifactStreamImpl, {
  name: "analyze_artifact",
  run_type: "llm",
  metadata: {
    ...MODEL_METADATA,
    ls_temperature: 0.2,
    ls_max_tokens: 1500,
  },
  tags: ["analyze", "streaming"],
  processInputs: (inputs) => {
    const [input] = inputs.args as [AnalyzeArtifactInput];
    const { params } = buildAnalyzeArtifactRequest(input);

    return {
      model: MODEL,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      grade_span: input.gradeSpan,
      exact_grade: input.exactGrade ?? null,
      provided_level: input.providedLevel ?? null,
      system_prompt: params.system,
      context_text: extractUserTextFromAnthropicParams(params),
      images: describeImages(input.images),
    };
  },
});

export async function analyzeArtifact(
  input: AnalyzeArtifactInput,
): Promise<Insight> {
  return analyzeArtifactStream(input);
}

export interface RemixScaffoldInput {
  domain?: ElpacDomain;
  gradeSpan: GradeSpan;
  exactGrade?: ExactGrade | null;
  estimatedLevel: number;
  strengths: string;
  levelReasoning: string;
  gapToNext: string;
  originalScaffold: string;
  originalSources?: ScaffoldSource[];
  priorRemixTexts?: string[];
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

function formatAvoidedFrameworkMoves(sources: ScaffoldSource[] | undefined): string {
  if (!sources?.length) {
    return "";
  }

  const lines = sources.map((source) => {
    const label = formatScaffoldSourceLabel(source);
    const anchor = source.anchor ? ` — ${source.anchor}` : "";
    return `- ${label}${anchor}`;
  });

  return `
FRAMEWORK MOVES ALREADY USED (do not reuse these):
${lines.join("\n")}
Choose a different [F#] move from the suggested moves above.`;
}

function formatPriorRemixTexts(priorRemixTexts: string[] | undefined): string {
  if (!priorRemixTexts?.length) {
    return "";
  }

  const lines = priorRemixTexts.map(
    (text, index) => `${index + 1}. ${text}`,
  );

  return `
PREVIOUS ALTERNATIVES (do not repeat or closely paraphrase):
${lines.join("\n")}`;
}

function sourcesOverlapOriginals(
  sources: ScaffoldSource[],
  originalAnchors: Set<string>,
): boolean {
  if (originalAnchors.size === 0) {
    return false;
  }

  return sources.some(
    (source) => source.anchor != null && originalAnchors.has(source.anchor),
  );
}

function formatOverlapRetryInstruction(
  sources: ScaffoldSource[],
  originalAnchors: Set<string>,
): string {
  const reused = sources
    .filter((source) => source.anchor != null && originalAnchors.has(source.anchor))
    .map((source) => source.anchor)
    .filter((anchor): anchor is string => anchor != null);

  if (reused.length === 0) {
    return "Your previous response reused a framework move that was already used. Choose a completely different [F#] move from the suggested moves above.";
  }

  return `Your previous response reused framework move(s) already used: ${reused.join(", ")}. You MUST choose a completely different [F#] move from the suggested moves above.`;
}

interface RemixGenerationResult {
  scaffold: string;
  scaffoldSources: ScaffoldSource[];
}

interface RemixCallParams {
  extraInstruction: string;
  temperature: number;
  attempt: 1 | 2;
  retryReason?: string;
}

async function generateRemixWithRetry(
  client: Anthropic,
  options: {
    systemPrompt: string;
    citableMoves: ReturnType<typeof buildSystemPrompt>["citableMoves"];
    userMessage: string;
    tool: Anthropic.Tool;
    toolName: string;
    maxTokens: number;
    originalAnchors: Set<string>;
  },
): Promise<RemixGenerationResult> {
  const callModel = traceable(
    async (callParams: RemixCallParams): Promise<RemixGenerationResult> => {
      const runTree = getCurrentRunTree(true);
      if (runTree) {
        runTree.tags = [
          ...(runTree.tags ?? []),
          "remix",
          `attempt:${callParams.attempt}`,
        ];
      }

      const message =
        callParams.extraInstruction.length > 0
          ? `${options.userMessage}\n\n${callParams.extraInstruction}`
          : options.userMessage;

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: options.maxTokens,
        temperature: callParams.temperature,
        system: options.systemPrompt,
        tools: [options.tool],
        tool_choice: { type: "tool", name: options.toolName },
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: message }],
          },
        ],
      });

      attachUsage(response);

      const toolBlock = response.content.find((block) => block.type === "tool_use");

      if (!toolBlock || toolBlock.type !== "tool_use") {
        console.error("[claude] No tool_use block in remix response");
        throw new ClaudeParseError("Remix response was empty");
      }

      if (toolBlock.name !== options.toolName) {
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
        options.citableMoves,
      );

      return { scaffold, scaffoldSources };
    },
    {
      name: "remix_call",
      run_type: "llm",
      metadata: {
        ...MODEL_METADATA,
        ls_max_tokens: options.maxTokens,
      },
      tags: ["remix"],
      processInputs: (callParams) => {
        const params = callParams as RemixCallParams;
        const message =
          params.extraInstruction.length > 0
            ? `${options.userMessage}\n\n${params.extraInstruction}`
            : options.userMessage;

        return {
          model: MODEL,
          temperature: params.temperature,
          max_tokens: options.maxTokens,
          system_prompt: options.systemPrompt,
          user_message: message,
          attempt: params.attempt,
          retry_reason: params.retryReason ?? null,
        };
      },
    },
  );

  const first = await callModel({
    extraInstruction: "",
    temperature: 0.7,
    attempt: 1,
  });

  if (!sourcesOverlapOriginals(first.scaffoldSources, options.originalAnchors)) {
    return first;
  }

  const retryInstruction = formatOverlapRetryInstruction(
    first.scaffoldSources,
    options.originalAnchors,
  );

  return callModel({
    extraInstruction: retryInstruction,
    temperature: 0.9,
    attempt: 2,
    retryReason: retryInstruction,
  });
}

async function remixScaffoldImpl(
  input: RemixScaffoldInput,
): Promise<RemixScaffoldResult> {
  const client = getClient();
  const originalAnchors = getScaffoldSourceAnchors(input.originalSources);
  const { systemPrompt, citableMoves } = buildSystemPrompt(
    input.domain ?? "writing",
    input.gradeSpan,
    input.exactGrade,
    originalAnchors.size > 0 ? { excludeAnchors: originalAnchors } : undefined,
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
${formatAvoidedFrameworkMoves(input.originalSources)}${formatPriorRemixTexts(input.priorRemixTexts)}

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

  const { scaffold, scaffoldSources } = await generateRemixWithRetry(client, {
    systemPrompt,
    citableMoves,
    userMessage,
    tool: REMIX_TOOL,
    toolName: REMIX_TOOL_NAME,
    maxTokens: 700,
    originalAnchors,
  });

  return {
    scaffold,
    ...(scaffoldSources.length > 0 ? { scaffold_sources: scaffoldSources } : {}),
  };
}

export const remixScaffold = traceable(remixScaffoldImpl, {
  name: "remix_scaffold",
  run_type: "chain",
  tags: ["remix", "scaffold"],
  processInputs: (input) => {
    const remixInput = input as RemixScaffoldInput;

    return {
      grade_span: remixInput.gradeSpan,
      exact_grade: remixInput.exactGrade ?? null,
      estimated_level: remixInput.estimatedLevel,
      original_sources_count: remixInput.originalSources?.length ?? 0,
      prior_remix_count: remixInput.priorRemixTexts?.length ?? 0,
    };
  },
});

async function remixScaffoldItemImpl(
  input: RemixItemInput,
): Promise<RemixScaffoldResult> {
  const client = getClient();
  const originalAnchors = getScaffoldSourceAnchors(input.originalItemSources);
  const { systemPrompt, citableMoves } = buildSystemPrompt(
    input.domain ?? "writing",
    input.gradeSpan,
    input.exactGrade,
    originalAnchors.size > 0 ? { excludeAnchors: originalAnchors } : undefined,
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
${formatAvoidedFrameworkMoves(input.originalItemSources)}${formatPriorRemixTexts(input.priorRemixTexts)}

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

  const { scaffold, scaffoldSources } = await generateRemixWithRetry(client, {
    systemPrompt,
    citableMoves,
    userMessage,
    tool: REMIX_ITEM_TOOL,
    toolName: REMIX_ITEM_TOOL_NAME,
    maxTokens: 500,
    originalAnchors,
  });

  return {
    scaffold,
    ...(scaffoldSources.length > 0 ? { scaffold_sources: scaffoldSources } : {}),
  };
}

export const remixScaffoldItem = traceable(remixScaffoldItemImpl, {
  name: "remix_scaffold_item",
  run_type: "chain",
  tags: ["remix", "scaffold_item"],
  processInputs: (input) => {
    const remixInput = input as RemixItemInput;

    return {
      grade_span: remixInput.gradeSpan,
      exact_grade: remixInput.exactGrade ?? null,
      estimated_level: remixInput.estimatedLevel,
      original_sources_count: remixInput.originalItemSources?.length ?? 0,
      prior_remix_count: remixInput.priorRemixTexts?.length ?? 0,
    };
  },
});
