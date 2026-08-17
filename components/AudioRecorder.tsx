"use client";

import { useRef, useState } from "react";
import {
  ACCEPTED_AUDIO_MIME_TYPES,
  MAX_AUDIO_DURATION_SECONDS,
  MAX_AUDIO_UPLOAD_BYTES,
  MIN_AUDIO_DURATION_SECONDS,
} from "@/lib/audio/constants";
import { startMicrophoneRecorder } from "@/lib/audio/capture";
import { btnPrimaryClassName, btnSecondaryClassName } from "@/lib/ui/styles";

export interface RecordedAudio {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  fileName: string;
}

interface AudioRecorderProps {
  onRecordingReady: (recording: RecordedAudio | null) => void;
  recording: RecordedAudio | null;
  disabled?: boolean;
}

export function AudioRecorder({
  onRecordingReady,
  recording,
  disabled = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<Awaited<ReturnType<typeof startMicrophoneRecorder>> | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleStartRecording() {
    setError(null);
    try {
      const recorder = await startMicrophoneRecorder({
        onDuration: setElapsed,
      });
      recorderRef.current = recorder;
      setIsRecording(true);
      setElapsed(0);
      onRecordingReady(null);
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : "Could not access the microphone.",
      );
    }
  }

  async function handleStopRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;

    try {
      const result = await recorder.stop();
      if (result.durationSeconds < MIN_AUDIO_DURATION_SECONDS) {
        setError(
          `Recording must be at least ${MIN_AUDIO_DURATION_SECONDS} seconds.`,
        );
        onRecordingReady(null);
      } else if (result.blob.size > MAX_AUDIO_UPLOAD_BYTES) {
        setError("Recording is too large. Try a shorter clip.");
        onRecordingReady(null);
      } else {
        onRecordingReady({
          blob: result.blob,
          mimeType: result.mimeType,
          durationSeconds: result.durationSeconds,
          fileName: `speaking-${Date.now()}.webm`,
        });
      }
    } catch (stopError) {
      setError(
        stopError instanceof Error ? stopError.message : "Recording failed.",
      );
    } finally {
      recorderRef.current = null;
      setIsRecording(false);
    }
  }

  function handleUploadFile(file: File | null) {
    setError(null);
    if (!file) {
      onRecordingReady(null);
      return;
    }

    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      setError("Audio file is too large for upload.");
      onRecordingReady(null);
      return;
    }

    onRecordingReady({
      blob: file,
      mimeType: file.type || "audio/webm",
      durationSeconds: 0,
      fileName: file.name,
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-soft bg-brand-soft/20 p-4">
      <p className="text-sm font-medium text-brand-dark">Student speaking sample</p>
      <p className="text-xs text-muted">
        Record up to {MAX_AUDIO_DURATION_SECONDS} seconds, or upload a file from
        your phone. Audio is processed in memory only and is never stored.
      </p>

      <div className="flex flex-wrap gap-3">
        {!isRecording ? (
          <button
            type="button"
            className={btnPrimaryClassName}
            disabled={disabled}
            onClick={() => void handleStartRecording()}
          >
            Start recording
          </button>
        ) : (
          <button
            type="button"
            className={btnPrimaryClassName}
            onClick={() => void handleStopRecording()}
          >
            Stop recording
          </button>
        )}
        <button
          type="button"
          className={btnSecondaryClassName}
          disabled={disabled || isRecording}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload recording
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AUDIO_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(event) => handleUploadFile(event.target.files?.[0] ?? null)}
      />

      {isRecording ? (
        <p className="text-sm text-muted" role="status">
          Recording… {Math.round(elapsed)}s / {MAX_AUDIO_DURATION_SECONDS}s
        </p>
      ) : null}

      {recording ? (
        <p className="text-sm text-brand-dark" role="status">
          Ready: {recording.fileName}
          {recording.durationSeconds > 0
            ? ` (${Math.round(recording.durationSeconds)}s)`
            : ""}
        </p>
      ) : null}

      {error ? <p className="text-sm text-accent-orange">{error}</p> : null}
    </div>
  );
}
