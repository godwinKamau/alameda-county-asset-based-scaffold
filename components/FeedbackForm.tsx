"use client";

import { useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  FEEDBACK_AREAS,
  FEEDBACK_AREA_LABELS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  MAX_FEEDBACK_MESSAGE_LENGTH,
  type FeedbackArea,
  type FeedbackCategory,
} from "@/lib/feedback/types";
import { apiFetch, isDatabaseWakingError } from "@/lib/ui/api-fetch";
import {
  btnPrimaryClassName,
  cardClassName,
  helperTextClassName,
  inputClassName,
  labelClassName,
  mutedTextClassName,
  requiredDotClassName,
  sectionTitleClassName,
  selectClassName,
} from "@/lib/ui/styles";

interface FeedbackFormProps {
  teacherName: string;
  gradeAccessLabel: string;
}

export function FeedbackForm({
  teacherName,
  gradeAccessLabel,
}: FeedbackFormProps) {
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [pageArea, setPageArea] = useState<FeedbackArea>("not_specific");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    if (!category) {
      setError("Please choose a category.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await apiFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          page_area: pageArea === "not_specific" ? null : pageArea,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Failed to submit feedback");
        return;
      }

      setSuccess(true);
      setMessage("");
      setCategory("");
      setPageArea("not_specific");
    } catch (submitError) {
      if (isDatabaseWakingError(submitError)) return;
      setError("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={cardClassName}>
      <h2 className={sectionTitleClassName}>Share feedback</h2>
      <p className={`mt-2 ${mutedTextClassName}`}>
        Tell us what is working, what is confusing, or what you would like to
        see improved. This feedback is about the app itself, not about a
        specific student.
      </p>

      <dl className="mt-4 grid gap-3 rounded-2xl bg-brand-soft/60 px-4 py-3 text-sm">
        <div>
          <dt className="font-medium text-brand-dark">Submitting as</dt>
          <dd className="mt-0.5 text-muted">{teacherName}</dd>
        </div>
        <div>
          <dt className="font-medium text-brand-dark">Grade access</dt>
          <dd className="mt-0.5 text-muted">{gradeAccessLabel}</dd>
        </div>
      </dl>

      {success ? (
        <p className="mt-4 text-sm text-accent-green" role="status">
          Thank you — your feedback was submitted.
        </p>
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-4 grid gap-4"
      >
        <div>
          <label htmlFor="feedback-category" className={labelClassName}>
            Category
            <span className={requiredDotClassName} aria-hidden="true" />
          </label>
          <select
            id="feedback-category"
            className={`${selectClassName} mt-1 w-full`}
            value={category}
            required
            disabled={submitting}
            onChange={(event) =>
              setCategory(event.target.value as FeedbackCategory | "")
            }
          >
            <option value="" disabled>
              Select a category
            </option>
            {FEEDBACK_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {FEEDBACK_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="feedback-page-area" className={labelClassName}>
            Page or area <span className="text-muted">(optional)</span>
          </label>
          <select
            id="feedback-page-area"
            className={`${selectClassName} mt-1 w-full`}
            value={pageArea}
            disabled={submitting}
            onChange={(event) =>
              setPageArea(event.target.value as FeedbackArea)
            }
          >
            {FEEDBACK_AREAS.map((value) => (
              <option key={value} value={value}>
                {FEEDBACK_AREA_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="feedback-message" className={labelClassName}>
            Message
            <span className={requiredDotClassName} aria-hidden="true" />
          </label>
          <textarea
            id="feedback-message"
            className={`${inputClassName} mt-1 min-h-32 w-full resize-y`}
            value={message}
            required
            disabled={submitting}
            maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
            placeholder="Describe what happened or what you would like to see changed."
            onChange={(event) => setMessage(event.target.value)}
          />
          <p className={helperTextClassName}>
            Please do not include student names or labels. Maximum{" "}
            {MAX_FEEDBACK_MESSAGE_LENGTH.toLocaleString()} characters.
          </p>
        </div>

        <div>
          <button
            type="submit"
            className={btnPrimaryClassName}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Submitting…" : "Submit feedback"}
          </button>
        </div>
      </form>
    </section>
  );
}
