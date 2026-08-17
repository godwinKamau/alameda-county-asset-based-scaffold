import type { Insight } from "@/lib/types";

export type AnalyzeStreamEvent =
  | { type: "stage"; stage: "preparing" | "transcribing" | "analyzing" }
  | { type: "snapshot"; insight: Partial<Insight> }
  | { type: "complete"; sessionId: string; insight: Insight }
  | { type: "error"; message: string };

export async function consumeAnalyzeStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onStage?: (stage: AnalyzeStreamEvent & { type: "stage" }) => void;
    onSnapshot?: (insight: Partial<Insight>) => void;
    onComplete?: (sessionId: string, insight: Insight) => void;
    onError?: (message: string) => void;
  },
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const dispatch = (event: AnalyzeStreamEvent) => {
    switch (event.type) {
      case "stage":
        handlers.onStage?.(event);
        break;
      case "snapshot":
        handlers.onSnapshot?.(event.insight);
        break;
      case "complete":
        completed = true;
        handlers.onComplete?.(event.sessionId, event.insight);
        break;
      case "error":
        handlers.onError?.(event.message);
        break;
      default:
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let event: AnalyzeStreamEvent;
      try {
        event = JSON.parse(trimmed) as AnalyzeStreamEvent;
      } catch {
        throw new Error("Analysis failed. Please try again.");
      }

      dispatch(event);
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    try {
      dispatch(JSON.parse(trailing) as AnalyzeStreamEvent);
    } catch {
      throw new Error("Analysis failed. Please try again.");
    }
  }

  return completed;
}
