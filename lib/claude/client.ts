import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/elpac/prompt";
import { InsightSchema, type ExactGrade, type GradeSpan, type Insight } from "@/lib/types";

const MODEL = "claude-sonnet-4-6";

export class ClaudeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeParseError";
  }
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
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

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("[claude] No text block in response");
    throw new ClaudeParseError("Analysis response was empty");
  }

  const rawText = textBlock.text;
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch {
    console.error("[claude] Failed to parse JSON from response");
    throw new ClaudeParseError("Analysis response was not valid JSON");
  }

  const validated = InsightSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[claude] Insight schema validation failed");
    throw new ClaudeParseError("Analysis response did not match expected format");
  }

  return validated.data;
}
