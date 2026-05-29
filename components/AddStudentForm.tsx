"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { matchExistingSubject } from "@/lib/roster/subject";
import { EXACT_GRADES } from "@/lib/roster/grade";
import { deriveGradeSpan, type ExactGrade, type GradeSpan } from "@/lib/types";
import {
  btnDashboardActionClassName,
  cardClassName,
  labelClassName,
  mutedTextClassName,
  sectionTitleClassName,
  inputClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { ErrorBanner } from "./ErrorBanner";
import { SubjectInput } from "./SubjectInput";

const GRADE_SPANS: GradeSpan[] = ["K", "1-2", "3-12"];

interface AddStudentFormProps {
  existingSubjects: string[];
}

export function AddStudentForm({ existingSubjects }: AddStudentFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [exactGrade, setExactGrade] = useState("");
  const [gradeSpan, setGradeSpan] = useState<GradeSpan | "">("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const label = String(formData.get("label") ?? "").trim();
    const canonicalSubject = matchExistingSubject(subject, existingSubjects);
    const resolvedGradeSpan = exactGrade
      ? deriveGradeSpan(exactGrade as ExactGrade)
      : gradeSpan;
    const knownLevelRaw = String(formData.get("known_elpac_level") ?? "").trim();

    if (!label) {
      setError("Student name is required.");
      return;
    }

    if (!resolvedGradeSpan || !GRADE_SPANS.includes(resolvedGradeSpan)) {
      setError("Please select a grade span or exact grade.");
      return;
    }

    if (exactGrade && gradeSpan && deriveGradeSpan(exactGrade as ExactGrade) !== gradeSpan) {
      setError("Exact grade conflicts with the selected grade span.");
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
      const response = await fetch("/api/roster/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          subject: canonicalSubject || undefined,
          grade_span: resolvedGradeSpan,
          exact_grade: exactGrade || null,
          known_elpac_level: knownElpacLevel,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add student");
      }

      setSuccess(`Added ${label} to your roster.`);
      form.reset();
      setSubject("");
      setExactGrade("");
      setGradeSpan("");
      router.refresh();
    } catch (addError) {
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
        Add a single student to your roster without uploading a CSV.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="add-student-label"
            className={labelClassName}
          >
            Student name
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
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="add-student-subject"
            className={labelClassName}
          >
            Subject <span className="text-muted">(optional)</span>
          </label>
          <SubjectInput
            id="add-student-subject"
            value={subject}
            onChange={setSubject}
            existingSubjects={existingSubjects}
          />
        </div>

        <div>
          <label
            htmlFor="add-student-exact-grade"
            className={labelClassName}
          >
            Exact grade <span className="text-muted">(optional)</span>
          </label>
          <select
            id="add-student-exact-grade"
            value={exactGrade}
            onChange={(event) => {
              const value = event.target.value;
              setExactGrade(value);
              if (value) {
                setGradeSpan(deriveGradeSpan(value as ExactGrade));
              }
            }}
            className={selectClassName}
          >
            <option value="">Not set</option>
            {EXACT_GRADES.map((grade) => (
              <option key={grade} value={grade}>
                {grade === "K" ? "Grade K" : `Grade ${grade}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="add-student-grade-span"
            className={labelClassName}
          >
            Grade span
          </label>
          <select
            id="add-student-grade-span"
            value={gradeSpan}
            onChange={(event) =>
              setGradeSpan(event.target.value as GradeSpan | "")
            }
            disabled={Boolean(exactGrade)}
            required={!exactGrade}
            className={`${selectClassName} disabled:opacity-60`}
          >
            <option value="" disabled>
              Select grade span
            </option>
            {GRADE_SPANS.map((span) => (
              <option key={span} value={span}>
                {span}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="add-student-known-level"
            className={labelClassName}
          >
            Known ELPAC level <span className="text-muted">(optional)</span>
          </label>
          <select
            id="add-student-known-level"
            name="known_elpac_level"
            defaultValue=""
            className={selectClassName}
          >
            <option value="">Not set</option>
            {[1, 2, 3, 4].map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className={btnDashboardActionClassName}
          >
            {submitting ? "Adding…" : "Add Student"}
          </button>
        </div>
      </form>

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
