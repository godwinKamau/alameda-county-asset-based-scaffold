"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { matchExistingSubject } from "@/lib/roster/subject";
import type { GradeSpan } from "@/lib/types";
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const label = String(formData.get("label") ?? "").trim();
    const canonicalSubject = matchExistingSubject(subject, existingSubjects);
    const gradeSpan = String(formData.get("grade_span") ?? "") as GradeSpan;
    const knownLevelRaw = String(formData.get("known_elpac_level") ?? "").trim();

    if (!label) {
      setError("Student name is required.");
      return;
    }

    if (!GRADE_SPANS.includes(gradeSpan)) {
      setError("Please select a grade span.");
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
          grade_span: gradeSpan,
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
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Add Student</h2>
      <p className="mt-1 text-sm text-slate-600">
        Add a single student to your roster without uploading a CSV.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="add-student-label"
            className="block text-sm font-medium text-slate-700"
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
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="add-student-subject"
            className="block text-sm font-medium text-slate-700"
          >
            Subject <span className="text-slate-400">(optional)</span>
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
            htmlFor="add-student-grade-span"
            className="block text-sm font-medium text-slate-700"
          >
            Grade span
          </label>
          <select
            id="add-student-grade-span"
            name="grade_span"
            required
            defaultValue=""
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="block text-sm font-medium text-slate-700"
          >
            Known ELPAC level <span className="text-slate-400">(optional)</span>
          </label>
          <select
            id="add-student-known-level"
            name="known_elpac_level"
            defaultValue=""
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add student"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {success && (
        <p className="mt-4 text-sm text-emerald-700">{success}</p>
      )}
    </div>
  );
}
