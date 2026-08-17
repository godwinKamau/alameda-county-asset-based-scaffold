"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/ui/api-fetch";
import {
  btnPrimaryClassName,
  btnSecondaryClassName,
  labelClassName,
  selectClassName,
} from "@/lib/ui/styles";

export interface RecordingConsentState {
  districtEnabled: boolean;
  consented: boolean;
  status: "granted" | "denied" | null;
  source: string | null;
  recordedAt: string | null;
}

interface RecordingConsentPanelProps {
  studentUuid: string;
  state: RecordingConsentState | null;
  loading?: boolean;
  onUpdated: (state: RecordingConsentState) => void;
}

const SOURCE_OPTIONS = [
  { value: "district_agreement", label: "District blanket agreement" },
  { value: "signed_form_on_file", label: "Signed consent form on file" },
  { value: "other", label: "Other documented consent" },
] as const;

export function RecordingConsentPanel({
  studentUuid,
  state,
  loading = false,
  onUpdated,
}: RecordingConsentPanelProps) {
  const [source, setSource] = useState<
    "district_agreement" | "signed_form_on_file" | "other"
  >("signed_form_on_file");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !state) {
    return (
      <p className="text-sm text-muted" role="status">
        Checking recording consent…
      </p>
    );
  }

  if (!state.districtEnabled) {
    return (
      <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-4 text-sm text-brand-dark">
        Audio recording is not enabled for your district. Contact your
        administrator before recording student speech.
      </div>
    );
  }

  async function recordConsent(status: "granted" | "denied") {
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/students/${encodeURIComponent(studentUuid)}/recording-consent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            source,
            note: note.trim() || undefined,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not record consent.",
        );
      }
      onUpdated(data as RecordingConsentState);
      setNote("");
    } catch (recordError) {
      setError(
        recordError instanceof Error
          ? recordError.message
          : "Could not record consent.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeConsent() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/students/${encodeURIComponent(studentUuid)}/recording-consent`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not revoke consent.",
        );
      }
      onUpdated(data as RecordingConsentState);
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Could not revoke consent.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state.consented) {
    return (
      <div className="space-y-2 rounded-xl border border-brand-soft bg-brand-soft/20 p-4">
        <p className="text-sm font-medium text-brand-dark">
          Recording consent on file
        </p>
        <p className="text-xs text-muted">
          {state.source ? `Source: ${state.source.replaceAll("_", " ")}` : null}
          {state.recordedAt
            ? ` · Recorded ${new Date(state.recordedAt).toLocaleDateString()}`
            : null}
        </p>
        <button
          type="button"
          className={btnSecondaryClassName}
          disabled={submitting}
          onClick={() => void revokeConsent()}
        >
          Revoke consent
        </button>
        {error ? <p className="text-sm text-accent-orange">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-4">
      <p className="text-sm font-medium text-brand-dark">
        Record student consent before transcribing
      </p>
      <p className="text-xs text-muted">
        Attest that consent exists under district policy. The app does not store
        the signed form itself.
      </p>

      <div>
        <label htmlFor="consent_source" className={labelClassName}>
          Consent source
        </label>
        <select
          id="consent_source"
          value={source}
          onChange={(event) =>
            setSource(
              event.target.value as
                | "district_agreement"
                | "signed_form_on_file"
                | "other",
            )
          }
          className={selectClassName}
          disabled={submitting}
        >
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="consent_note" className={labelClassName}>
          Note (optional)
        </label>
        <textarea
          id="consent_note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-brand-soft bg-white px-3 py-2 text-sm"
          disabled={submitting}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={btnPrimaryClassName}
          disabled={submitting}
          onClick={() => void recordConsent("granted")}
        >
          {submitting ? "Saving…" : "Record consent"}
        </button>
      </div>

      {error ? <p className="text-sm text-accent-orange">{error}</p> : null}
    </div>
  );
}
