"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXACT_GRADES } from "@/lib/roster/grade";
import { deriveGradeSpan, type ExactGrade } from "@/lib/types";
import {
  btnDashboardActionClassName,
  cardClassName,
  helperTextClassName,
  inputClassName,
  labelClassName,
  mutedTextClassName,
  requiredDotClassName,
  sectionTitleClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { apiFetch, isDatabaseWakingError } from "@/lib/ui/api-fetch";
import { ErrorBanner } from "./ErrorBanner";

const ELPAC_LEVELS = [1, 2, 3, 4] as const;

interface AddStudentFormProps {
  existingSubjects?: string[];
  apiBase?: string;
  onAdded?: () => void;
}

export function AddStudentForm({
  apiBase = "/api/roster",
  onAdded,
}: AddStudentFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [exactGrade, setExactGrade] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const label = String(formData.get("label") ?? "").trim();
    const knownLevelRaw = String(formData.get("known_elpac_level") ?? "").trim();

    if (!label) {
      setError("Student label is required.");
      return;
    }

    if (!exactGrade) {
      setError("Please select a grade.");
      return;
    }

    let knownElpacLevel: number | null = null;
    if (knownLevelRaw) {
      const level = Number.parseInt(knownLevelRaw, 10);
      if (Number.isNaN(level) || level < 1 || level > 4) {
        setError("Known ELPAC level must be 1–4 when provided.");
        return;
      }
      knownElpacLevel = level;
    }

    setSubmitting(true);

    try {
      const grade = exactGrade as ExactGrade;
      const response = await apiFetch(`${apiBase}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          subject: "",
          grade_span: deriveGradeSpan(grade),
          exact_grade: grade,
          known_elpac_level: knownElpacLevel,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add student");
      }

      setSuccess(`Added ${label} to your roster.`);
      form.reset();
      setExactGrade("");
      onAdded?.() ?? router.refresh();
    } catch (addError) {
      if (isDatabaseWakingError(addError)) return;
      setError(
        addError instanceof Error ? addError.message : "Failed to add student",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cardClassName}>
      <h2 className={sectionTitleClassName}>Add Student</h2>
      <p className={`mt-1 ${mutedTextClassName}`}>
        Add a single student to your roster. Use Upload Roster in the header to
        add many at once.
      </p>

      <form
        id="add-student-form"
        onSubmit={handleSubmit}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label htmlFor="add-student-label" className={labelClassName}>
            Student label
            <span className={requiredDotClassName} aria-hidden="true" />
          </label>
          <input
            id="add-student-label"
            name="label"
            type="text"
            required
            autoComplete="off"
            placeholder="e.g. Maria G."
            className={inputClassName}
          />
          <p className={helperTextClassName}>
            <span className="font-medium text-brand-dark">FERPA note:</span> This
            label stays on your device and is never sent to our servers. Use a
            nickname or initials — not a legal name.
          </p>
        </div>

        <div>
          <label htmlFor="add-student-exact-grade" className={labelClassName}>
            Grade
            <span className={requiredDotClassName} aria-hidden="true" />
          </label>
          <select
            id="add-student-exact-grade"
            value={exactGrade}
            required
            onChange={(event) => setExactGrade(event.target.value)}
            className={selectClassName}
          >
            <option value="" disabled>
              Select grade
            </option>
            {EXACT_GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade === "K" ? "Kindergarten" : `Grade ${grade}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="add-student-known-level" className={labelClassName}>
            Known ELPAC level <span className="text-muted">(optional)</span>
          </label>
          <select
            id="add-student-known-level"
            name="known_elpac_level"
            defaultValue=""
            className={selectClassName}
          >
            <option value="">Not set</option>
            {ELPAC_LEVELS.map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </select>
          <p className={helperTextClassName}>
            Find the performance level on the student&apos;s ELPAC score report.
          </p>
        </div>
      </form>

      <div className="mt-4">
        <button
          type="submit"
          form="add-student-form"
          disabled={submitting}
          className={btnDashboardActionClassName}
        >
          {submitting ? "Adding…" : "Add Student"}
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {success && (
        <p className="mt-4 text-sm text-accent-green">{success}</p>
      )}
    </div>
  );
}
