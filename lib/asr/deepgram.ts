import "server-only";

import { normalizeDeepgramResponse } from "./normalize";
import type { AsrResult } from "./types";

const DEEPGRAM_URL =
  "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&utterances=false&detect_language=false&filler_words=true";

export async function transcribeWithDeepgram(
  audio: Buffer,
  mimeType: string,
): Promise<AsrResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not set");
  }

  const body = Uint8Array.from(audio);

  const response = await fetch(DEEPGRAM_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": mimeType || "audio/webm",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Speech transcription failed");
  }

  const payload: unknown = await response.json();
  return normalizeDeepgramResponse(payload as Parameters<typeof normalizeDeepgramResponse>[0]);
}
