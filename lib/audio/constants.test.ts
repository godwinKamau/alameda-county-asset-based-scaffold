import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  maxAudioBytesAtConfiguredBitrate,
} from "./constants.ts";

describe("audio constants", () => {
  it("configured max duration fits upload byte cap", () => {
    assert.ok(maxAudioBytesAtConfiguredBitrate() <= MAX_AUDIO_UPLOAD_BYTES);
  });
});
