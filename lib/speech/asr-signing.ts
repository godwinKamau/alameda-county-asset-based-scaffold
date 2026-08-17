import { createHmac, timingSafeEqual } from "node:crypto";
import type { AsrResult, FluencyMetrics } from "@/lib/asr/types";
import { computeFluencyMetrics } from "@/lib/speech/fluency";

export interface SignedAsrPayload {
  asr: AsrResult;
  metrics: FluencyMetrics;
}

function getSigningSecret(): string {
  const secret = process.env.ASR_SIGNING_SECRET;
  if (!secret) {
    throw new Error("ASR_SIGNING_SECRET is not set");
  }
  return secret;
}

function canonicalPayload(payload: SignedAsrPayload, wordCount: number): string {
  return JSON.stringify({
    provider: payload.asr.provider,
    model: payload.asr.model,
    durationSeconds: payload.asr.durationSeconds,
    meanConfidence: payload.asr.meanConfidence,
    wordCount,
    metrics: payload.metrics,
  });
}

export function signAsrPayload(payload: SignedAsrPayload): string {
  const hmac = createHmac("sha256", getSigningSecret());
  hmac.update(canonicalPayload(payload, payload.asr.words.length));
  return hmac.digest("base64url");
}

export function verifyAsrToken(
  payload: SignedAsrPayload,
  token: string,
  wordCount: number,
): boolean {
  const hmac = createHmac("sha256", getSigningSecret());
  hmac.update(canonicalPayload(payload, wordCount));
  const expected = hmac.digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  if (expectedBuffer.length !== tokenBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function buildSignedAsrPayload(asr: AsrResult): SignedAsrPayload {
  const metrics = computeFluencyMetrics(asr.words, asr.durationSeconds);
  return { asr, metrics };
}
