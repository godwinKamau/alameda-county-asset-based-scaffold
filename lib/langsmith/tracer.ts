import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { getCurrentRunTree } from "langsmith/traceable";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

export const MODEL_METADATA = {
  ls_provider: "anthropic",
  ls_model_name: CLAUDE_MODEL,
} as const;

export interface ImageDescriptorInput {
  mediaType: string;
}

export interface ImageDescriptor {
  count: number;
  media_types: string[];
}

export function describeImages(images: ImageDescriptorInput[]): ImageDescriptor {
  return {
    count: images.length,
    media_types: images.map((image) => image.mediaType),
  };
}

export function extractUserTextFromAnthropicParams(
  params: Pick<Anthropic.MessageCreateParams, "messages">,
): string | null {
  const content = params.messages[0]?.content;
  if (!Array.isArray(content)) {
    return null;
  }

  const textBlock = content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : null;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export function attachUsage(response: { usage?: AnthropicUsage | null }): void {
  const usage = response.usage;
  if (!usage) {
    return;
  }

  const runTree = getCurrentRunTree(true);
  if (!runTree) {
    return;
  }

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;

  runTree.metadata = {
    ...runTree.metadata,
    usage_metadata: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };
}
