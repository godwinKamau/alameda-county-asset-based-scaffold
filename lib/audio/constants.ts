import { MAX_UPLOAD_BYTES } from "@/lib/artifact/constants";

export const MAX_AUDIO_UPLOAD_BYTES = MAX_UPLOAD_BYTES;
export const MAX_AUDIO_DURATION_SECONDS = 180;
export const MIN_AUDIO_DURATION_SECONDS = 20;
export const AUDIO_BITS_PER_SECOND = 24000;

export const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

export const ACCEPTED_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
] as const;

/** Bytes budget check: 180s at 24kbps ≈ 540KB — well under 4MB. */
export function maxAudioBytesAtConfiguredBitrate(): number {
  return Math.ceil(
    (MAX_AUDIO_DURATION_SECONDS * AUDIO_BITS_PER_SECOND) / 8,
  );
}
