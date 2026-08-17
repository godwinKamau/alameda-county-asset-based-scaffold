import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consumeAnalyzeStream } from "./stream";

function streamFromLines(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
}

describe("consumeAnalyzeStream", () => {
  it("dispatches stage events", async () => {
    const stages: string[] = [];

    await consumeAnalyzeStream(
      streamFromLines([
        `${JSON.stringify({ type: "stage", stage: "preparing" })}\n`,
        `${JSON.stringify({ type: "stage", stage: "analyzing" })}\n`,
        `${JSON.stringify({
          type: "complete",
          sessionId: "session-stage",
          insight: { estimated_level: 2 },
        })}\n`,
      ]),
      {
        onStage: (event) => stages.push(event.stage),
      },
    );

    assert.deepEqual(stages, ["preparing", "analyzing"]);
  });

  it("dispatches snapshot, complete, and error events", async () => {
    const snapshots: unknown[] = [];
    let sessionId = "";
    let errorMessage = "";

    const completed = await consumeAnalyzeStream(
      streamFromLines([
        `${JSON.stringify({ type: "snapshot", insight: { strengths: "Uses details." } })}\n`,
        `${JSON.stringify({ type: "snapshot", insight: { estimated_level: 2 } })}\n`,
        `${JSON.stringify({
          type: "complete",
          sessionId: "session-123",
          insight: {
            strengths: "Uses details.",
            estimated_level: 2,
            level_reasoning: "Evidence.",
            gap_to_next: "Needs transitions.",
            scaffold: "1. **Move** Detail.",
          },
        })}\n`,
      ]),
      {
        onSnapshot: (insight) => snapshots.push(insight),
        onComplete: (id) => {
          sessionId = id;
        },
        onError: (message) => {
          errorMessage = message;
        },
      },
    );

    assert.equal(completed, true);
    assert.equal(snapshots.length, 2);
    assert.equal(sessionId, "session-123");
    assert.equal(errorMessage, "");
  });

  it("returns false when stream ends without complete", async () => {
    const completed = await consumeAnalyzeStream(
      streamFromLines([
        `${JSON.stringify({ type: "snapshot", insight: { strengths: "Partial." } })}\n`,
      ]),
      {},
    );

    assert.equal(completed, false);
  });

  it("handles error events", async () => {
    let caught = "";

    await assert.rejects(
      () =>
        consumeAnalyzeStream(
          streamFromLines([
            `${JSON.stringify({ type: "error", message: "Parse failed." })}\n`,
          ]),
          {
            onError: (message) => {
              throw new Error(message);
            },
          },
        ),
      (error: unknown) => {
        caught = error instanceof Error ? error.message : "";
        return caught === "Parse failed.";
      },
    );
  });
});
