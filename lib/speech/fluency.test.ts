import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AsrWord } from "@/lib/asr/types";
import { computeFluencyMetrics } from "./fluency.ts";

function word(
  text: string,
  start: number,
  end: number,
  confidence = 0.9,
): AsrWord {
  return { word: text, start, end, confidence };
}

describe("computeFluencyMetrics", () => {
  it("computes pause counts at thresholds", () => {
    const words = [
      word("one", 0, 0.4),
      word("two", 0.8, 1.1),
      word("three", 2.2, 2.5),
    ];
    const metrics = computeFluencyMetrics(words, 3);
    assert.equal(metrics.pauseCount250ms, 2);
    assert.equal(metrics.pauseCount1000ms, 1);
    assert.equal(metrics.longestPauseSeconds, 1.1);
  });

  it("bounds phonation time ratio to 0-1", () => {
    const metrics = computeFluencyMetrics([word("hi", 0, 0.5)], 1);
    assert.ok(metrics.phonationTimeRatio >= 0);
    assert.ok(metrics.phonationTimeRatio <= 1);
  });

  it("articulation rate is at least speech rate when pauses exist", () => {
    const words = [word("a", 0, 0.2), word("b", 1, 1.2)];
    const metrics = computeFluencyMetrics(words, 2);
    assert.ok(metrics.articulationRateWpm >= metrics.speechRateWpm);
  });

  it("detects filled pauses without substring false positives", () => {
    const metrics = computeFluencyMetrics(
      [word("um", 0, 0.2), word("umbrella", 0.3, 0.6)],
      1,
    );
    assert.equal(metrics.filledPauseCount, 1);
  });

  it("handles empty input", () => {
    const metrics = computeFluencyMetrics([], 0);
    assert.equal(metrics.speechRateWpm, 0);
    assert.equal(metrics.meanConfidence, 0);
  });
});
