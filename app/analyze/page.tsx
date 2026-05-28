"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ArtifactDropzone } from "@/components/ArtifactDropzone";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InsightCard } from "@/components/InsightCard";
import { LoadingArtifact } from "@/components/LoadingArtifact";
import { StudentSelector } from "@/components/StudentSelector";
import {
  MAX_PAGES_PER_ANALYSIS,
  MAX_SOURCE_ARTIFACT_BYTES,
  formatMegabytes,
} from "@/lib/artifact/constants";
import {
  isPdfFile,
  prepareArtifactForUpload,
} from "@/lib/artifact/prepare-upload";
import { normalizeSubject, sortSubjects } from "@/lib/roster/display";
import { parseAnalyzePrefill } from "@/lib/analyze/url";
import type { GradeSpan, Insight } from "@/lib/types";

export default function AnalyzePage() {
  const searchParams = useSearchParams();
  const [studentUuid, setStudentUuid] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [gradeSpan, setGradeSpan] = useState<GradeSpan>("3-12");
  const [providedLevel, setProvidedLevel] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing artifact…");
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);

  const handleSelectedPagesChange = useCallback((pages: number[]) => {
    setSelectedPages(pages);
  }, []);

  useEffect(() => {
    const prefill = parseAnalyzePrefill(searchParams);
    if (!prefill) return;

    setSubjectFilter(prefill.subject);
    setStudentUuid(prefill.studentUuid);
    setGradeSpan(prefill.gradeSpan);
    setProvidedLevel(prefill.providedLevel);
  }, [searchParams]);

  useEffect(() => {
    async function loadSubjects() {
      const response = await fetch("/api/roster/list");
      if (!response.ok) return;

      const data = await response.json();
      const subjects = new Set<string>();
      for (const entry of data.entries ?? []) {
        subjects.add(normalizeSubject(entry.subject));
      }
      setAvailableSubjects(sortSubjects([...subjects]));
    }

    loadSubjects();
  }, []);

  const handleStudentChange = useCallback(
    (
      uuid: string,
      option?: {
        grade_span: GradeSpan;
        known_elpac_level: number | null;
      },
    ) => {
      setStudentUuid(uuid);
      if (option) {
        setGradeSpan(option.grade_span);
        setProvidedLevel(
          option.known_elpac_level != null
            ? String(option.known_elpac_level)
            : "",
        );
      }
    },
    [],
  );

  function handleFileSelect(nextFile: File | null) {
    setFile(nextFile);
    setSelectedPages(nextFile && isPdfFile(nextFile) ? [1] : []);
  }

  const handlePreviewLoadingChange = useCallback((isLoading: boolean) => {
    setPreviewLoading(isLoading);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInsight(null);

    if (!studentUuid) {
      setError("Please select a student.");
      return;
    }

    if (!file) {
      setError("Please upload an artifact.");
      return;
    }

    if (file.size > MAX_SOURCE_ARTIFACT_BYTES) {
      setError(
        `File must be ${formatMegabytes(MAX_SOURCE_ARTIFACT_BYTES)} or smaller.`,
      );
      return;
    }

    if (isPdfFile(file) && selectedPages.length === 0) {
      setError("Select at least one PDF page containing student writing.");
      return;
    }

    if (selectedPages.length > MAX_PAGES_PER_ANALYSIS) {
      setError(`Select at most ${MAX_PAGES_PER_ANALYSIS} pages.`);
      return;
    }

    setLoading(true);
    setLoadingMessage("Preparing artifact…");

    try {
      const preparedFiles = await prepareArtifactForUpload(
        file,
        isPdfFile(file) ? { pdfPages: selectedPages } : undefined,
      );
      setLoadingMessage("Analyzing artifact…");

      const formData = new FormData();
      preparedFiles.forEach((preparedFile) => {
        formData.append("file", preparedFile);
      });
      formData.append("page_count", String(preparedFiles.length));
      formData.append("student_uuid", studentUuid);
      formData.append("grade_span", gradeSpan);
      if (providedLevel) {
        formData.append("provided_elpac_level", providedLevel);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Analysis failed");
      }

      setInsight(data.insight);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Analysis failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader title="New Analysis" />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="subject_filter"
                className="block text-sm font-medium text-slate-700"
              >
                Subject
              </label>
              <select
                id="subject_filter"
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All subjects</option>
                {availableSubjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <StudentSelector
              value={studentUuid}
              onChange={handleStudentChange}
              subjectFilter={subjectFilter}
            />
          </div>

          <ArtifactDropzone
            file={file}
            onFileSelect={handleFileSelect}
            selectedPages={selectedPages}
            onSelectedPagesChange={handleSelectedPagesChange}
            onPreviewLoadingChange={handlePreviewLoadingChange}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="grade_span"
                className="block text-sm font-medium text-slate-700"
              >
                Grade Span
              </label>
              <select
                id="grade_span"
                value={gradeSpan}
                onChange={(event) =>
                  setGradeSpan(event.target.value as GradeSpan)
                }
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="K">K</option>
                <option value="1-2">1-2</option>
                <option value="3-12">3-12</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="provided_level"
                className="block text-sm font-medium text-slate-700"
              >
                Known ELPAC Level (optional)
              </label>
              <select
                id="provided_level"
                value={providedLevel}
                onChange={(event) => setProvidedLevel(event.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Not specified</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || previewLoading}
            aria-busy={loading || previewLoading}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(loading || previewLoading) && (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
            )}
            {previewLoading
              ? "Loading preview…"
              : loading
                ? "Analyzing…"
                : "Analyze Artifact"}
          </button>
        </form>

        {error && <ErrorBanner message={error} />}
        {loading && <LoadingArtifact message={loadingMessage} />}
        {insight && !loading && <InsightCard insight={insight} />}
      </main>
    </>
  );
}
