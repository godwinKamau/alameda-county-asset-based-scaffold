import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeDeepgramResponse } from "./normalize.ts";

describe("normalizeDeepgramResponse", () => {
  it("maps word-level confidence and duration", () => {
    const result = normalizeDeepgramResponse({
      metadata: { duration: 12.5 },
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "hello world",
                confidence: 0.9,
                words: [
                  { word: "hello", start: 0, end: 0.4, confidence: 0.95 },
                  { word: "world", start: 0.5, end: 1.0, confidence: 0.85 },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(result.transcript, "hello world");
    assert.equal(result.durationSeconds, 12.5);
    assert.equal(result.words.length, 2);
    assert.equal(result.words[1]?.confidence, 0.85);
  });

  it("handles empty words safely", () => {
    const result = normalizeDeepgramResponse({
      metadata: { duration: 0 },
      results: { channels: [{ alternatives: [{ transcript: "", words: [] }] }] },
    });
    assert.equal(result.transcript, "");
    assert.equal(result.words.length, 0);
  });
});
