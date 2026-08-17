import type { AsrResult, AsrWord } from "./types";

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

interface DeepgramResponse {
  metadata?: { duration?: number };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: DeepgramWord[];
      }>;
    }>;
  };
}

export function normalizeDeepgramResponse(
  payload: DeepgramResponse,
  provider = "deepgram",
  model = "nova-3",
): AsrResult {
  const alternative =
    payload.results?.channels?.[0]?.alternatives?.[0] ?? {};
  const rawWords = alternative.words ?? [];

  const words: AsrWord[] = rawWords.map((word) => ({
    word: word.word,
    start: word.start,
    end: word.end,
    confidence: word.confidence ?? alternative.confidence ?? 0.5,
  }));

  const transcript = (alternative.transcript ?? words.map((w) => w.word).join(" ")).trim();
  const durationSeconds = payload.metadata?.duration ?? (words.at(-1)?.end ?? 0);
  const meanConfidence =
    words.length > 0
      ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length
      : alternative.confidence ?? 0;

  return {
    words,
    transcript,
    durationSeconds,
    meanConfidence,
    provider,
    model,
  };
}
