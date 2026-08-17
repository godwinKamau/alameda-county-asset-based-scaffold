import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import type { AsrResult, FluencyMetrics } from "@/lib/asr/types";
import {
  buildSignedAsrPayload,
  signAsrPayload,
  verifyAsrToken,
} from "./asr-signing";

const TEST_SECRET = "test-asr-signing-secret";

const sampleMetrics: FluencyMetrics = {
  speechRateWpm: 90,
  articulationRateWpm: 110,
  pauseCount250ms: 2,
  pauseCount1000ms: 0,
  longestPauseSeconds: 0.4,
  meanLengthOfRunWords: 4,
  longestRunWords: 6,
  phonationTimeRatio: 0.8,
  filledPauseCount: 1,
  meanConfidence: 0.92,
  lowConfidenceWordRatio: 0.05,
};

const sampleAsr: AsrResult = {
  words: [
    { word: "hello", start: 0, end: 0.4, confidence: 0.95 },
    { word: "world", start: 0.5, end: 0.9, confidence: 0.9 },
  ],
  transcript: "hello world",
  durationSeconds: 1.2,
  meanConfidence: 0.92,
  provider: "deepgram",
  model: "nova-3",
};

describe("asr-token", () => {
  before(() => {
    process.env.ASR_SIGNING_SECRET = TEST_SECRET;
  });

  after(() => {
    delete process.env.ASR_SIGNING_SECRET;
  });

  it("verifies tokens using the original ASR word count", () => {
    const signed = buildSignedAsrPayload(sampleAsr);
    signed.metrics = sampleMetrics;
    const token = signAsrPayload(signed);

    const verifyPayload = {
      asr: { ...sampleAsr, words: [] },
      metrics: sampleMetrics,
    };

    assert.equal(
      verifyAsrToken(verifyPayload, token, sampleAsr.words.length),
      true,
    );
  });

  it("rejects tokens when word count does not match", () => {
    const signed = buildSignedAsrPayload(sampleAsr);
    signed.metrics = sampleMetrics;
    const token = signAsrPayload(signed);

    const verifyPayload = {
      asr: { ...sampleAsr, words: [] },
      metrics: sampleMetrics,
    };

    assert.equal(verifyAsrToken(verifyPayload, token, 0), false);
  });
});
