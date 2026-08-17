"use client";

import { useState } from "react";
import type { ExactGrade } from "@/lib/types";
import { EXACT_GRADES } from "@/lib/roster/grade";
import {
  btnPrimaryClassName,
  cardClassName,
  inputClassName,
  sectionTitleClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

export function RequestGradeAccessForm() {
  const [exactGrade, setExactGrade] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiFetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exact_grade: exactGrade || null,
          reason: reason.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Failed to submit request");
        return;
      }

      setSuccess(true);
      setExactGrade("");
      setReason("");
    } catch {
      setError("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={cardClassName}>
      <h2 className={sectionTitleClassName}>Request grade access</h2>
      <p className="mt-2 text-sm text-muted">
        Ask an administrator for access to students in a grade. You will see them
        in Students once approved.
      </p>

      {success ? (
        <p className="mt-3 text-sm text-accent-green" role="status">
          Request submitted. An administrator will review it soon.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <label className="block text-sm">
          <span className="font-medium text-brand-dark">Grade</span>
          <select
            className={`${selectClassName} mt-1 w-full`}
            value={exactGrade}
            onChange={(e) => setExactGrade(e.target.value)}
          >
            <option value="">Whole school</option>
            {EXACT_GRADES.map((grade: ExactGrade) => (
              <option key={grade} value={grade}>
                {grade === "K" ? "Kindergarten" : `Grade ${grade}`}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-brand-dark">Reason (optional)</span>
          <input
            type="text"
            className={`${inputClassName} mt-1 w-full`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. I am the grade 3 ELD teacher this year"
          />
        </label>
        <div>
          <button
            type="submit"
            className={btnPrimaryClassName}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>
    </section>
  );
}
