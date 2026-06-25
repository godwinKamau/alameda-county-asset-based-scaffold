"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ArtifactDropzone } from "@/components/ArtifactDropzone";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  StudentSelector,
  type RosterOption,
} from "@/components/StudentSelector";
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
import { setPendingAnalyzeRequest } from "@/lib/analyze/pending-request";
import { getStudentDisplayName } from "@/lib/roster/display";
import type { GradeSpan } from "@/lib/types";
import { apiFetch, isDatabaseWakingError } from "@/lib/ui/api-fetch";
import {
  btnPrimaryClassName,
  btnSecondaryClassName,
  cardClassName,
  labelClassName,
  selectClassName,
} from "@/lib/ui/styles";

export default function AnalyzePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [studentUuid, setStudentUuid] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<RosterOption | null>(
    null,
  );
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
      try {
        const response = await apiFetch("/api/roster/list");
        if (!response.ok) return;

        const data = await response.json();
        const subjects = new Set<string>();
        for (const entry of data.entries ?? []) {
          subjects.add(normalizeSubject(entry.subject));
        }
        setAvailableSubjects(sortSubjects([...subjects]));
      } catch (loadError) {
        if (!isDatabaseWakingError(loadError)) {
          console.error("[analyze] Failed to load subjects", loadError);
        }
      }
    }

    loadSubjects();
  }, []);

  const handleStudentChange = useCallback(
    (uuid: string, option?: RosterOption) => {
      setStudentUuid(uuid);
      setSelectedStudent(option ?? null);
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

      setPendingAnalyzeRequest(formData, {
        studentUuid,
        studentLabel:
          selectedStudent?.label ??
          getStudentDisplayName({
            label: "",
            student_uuid: studentUuid,
          }),
        gradeSpan,
        providedLevel: providedLevel || null,
        subject: selectedStudent?.subject ?? "",
      });

      router.push("/analyze/results/streaming");
    } catch (submitError) {
      if (isDatabaseWakingError(submitError)) return;
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Analysis failed. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <DashboardShell title="New Analysis">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/dashboard" className={btnSecondaryClassName}>
          <span className="inline-flex items-center gap-2">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Back to Dashboard
          </span>
        </Link>

        <form onSubmit={handleSubmit} className={`${cardClassName} space-y-6`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="subject_filter" className={labelClassName}>
                Subject
              </label>
              <select
                id="subject_filter"
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                className={selectClassName}
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
              <label htmlFor="grade_span" className={labelClassName}>
                Grade Span
              </label>
              <select
                id="grade_span"
                value={gradeSpan}
                onChange={(event) =>
                  setGradeSpan(event.target.value as GradeSpan)
                }
                className={selectClassName}
              >
                <option value="K">K</option>
                <option value="1-2">1-2</option>
                <option value="3-12">3-12</option>
              </select>
            </div>

            <div>
              <label htmlFor="provided_level" className={labelClassName}>
                Known ELPAC Level (optional)
              </label>
              <select
                id="provided_level"
                value={providedLevel}
                onChange={(event) => setProvidedLevel(event.target.value)}
                className={selectClassName}
              >
                <option value="">Not specified</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading || previewLoading}
              aria-busy={loading || previewLoading}
              className={`${btnPrimaryClassName} inline-flex items-center gap-2`}
            >
              {(loading || previewLoading) && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
              )}
              Analyze Artifact
            </button>
            {(loading || previewLoading) && (
              <p
                className="text-sm font-medium text-muted"
                role="status"
                aria-live="polite"
              >
                {previewLoading ? "Loading page previews…" : loadingMessage}
              </p>
            )}
          </div>
        </form>

        {error && <ErrorBanner message={error} />}
      </div>
    </DashboardShell>
  );
}
