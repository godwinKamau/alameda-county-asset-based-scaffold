"use client";

import { useMemo, useState } from "react";
import type { AsrWord } from "@/lib/asr/types";
import { btnPrimaryClassName, labelClassName } from "@/lib/ui/styles";

const LOW_CONFIDENCE_THRESHOLD = 0.6;

interface TranscriptReviewProps {
  words: AsrWord[];
  initialTranscript: string;
  onConfirm: (transcript: string, edited: boolean) => void;
  disabled?: boolean;
}

export function TranscriptReview({
  words,
  initialTranscript,
  onConfirm,
  disabled = false,
}: TranscriptReviewProps) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [confirmed, setConfirmed] = useState(false);

  const lowConfidenceWords = useMemo(
    () =>
      new Set(
        words
          .filter((word) => word.confidence < LOW_CONFIDENCE_THRESHOLD)
          .map((word) => word.word.toLowerCase()),
      ),
    [words],
  );

  function handleConfirm() {
    const edited = transcript.trim() !== initialTranscript.trim();
    setConfirmed(true);
    onConfirm(transcript.trim(), edited);
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-soft bg-white p-4">
      <div>
        <p className="text-sm font-medium text-brand-dark">
          Review transcript before analysis
        </p>
        <p className="mt-1 text-xs text-muted">
          Correct any words the speech recognizer misheard. Low-confidence words
          are highlighted below.
        </p>
      </div>

      {lowConfidenceWords.size > 0 ? (
        <p className="text-xs text-accent-orange">
          Low-confidence words:{" "}
          {[...lowConfidenceWords].slice(0, 12).join(", ")}
          {lowConfidenceWords.size > 12 ? "…" : ""}
        </p>
      ) : null}

      <div>
        <label htmlFor="transcript_review" className={labelClassName}>
          Transcript
        </label>
        <textarea
          id="transcript_review"
          value={transcript}
          onChange={(event) => {
            setConfirmed(false);
            setTranscript(event.target.value);
          }}
          rows={8}
          className="mt-2 w-full rounded-xl border border-brand-soft px-3 py-2 text-sm text-brand-dark"
          disabled={disabled}
        />
      </div>

      <button
        type="button"
        className={btnPrimaryClassName}
        disabled={disabled || !transcript.trim() || confirmed}
        onClick={handleConfirm}
      >
        {confirmed ? "Transcript confirmed" : "Confirm transcript"}
      </button>
    </div>
  );
}
