import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/elpac/prompt";
import { InsightSchema, type ExactGrade, type GradeSpan, type Insight } from "@/lib/types";

const MODEL = "claude-sonnet-4-6";
const INSIGHT_TOOL_NAME = "submit_insight";

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
  const systemPrompt = buildSystemPrompt(input.gradeSpan, input.exactGrade);

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

  const validated = InsightSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[claude] Insight schema validation failed");
    throw new ClaudeParseError("Analysis response did not match expected format");
  }

  return validated.data;
}
