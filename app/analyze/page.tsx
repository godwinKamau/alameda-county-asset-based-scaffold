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
import {
  ELPAC_DOMAINS,
  domainLabel,
  type ElpacDomain,
} from "@/lib/elpac/domain";
import {
  evidenceKindLabel,
  evidenceValidity,
  isValidEvidence,
  recommendedEvidenceKind,
  selectableEvidenceKinds,
  type EvidenceKind,
} from "@/lib/elpac/evidence";
import { AudioRecorder, type RecordedAudio } from "@/components/AudioRecorder";
import { ObservationProtocol } from "@/components/ObservationProtocol";
import { RecordingConsentPanel } from "@/components/RecordingConsentPanel";
import type { ObservationInput } from "@/lib/elpac/observation";
import { TranscriptReview } from "@/components/TranscriptReview";
import type { PldLevel } from "@/lib/elpac/types";
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
  const [domain, setDomain] = useState<ElpacDomain>("writing");
  const [evidenceKind, setEvidenceKind] = useState<EvidenceKind>("written_artifact");
  const [gradeSpan, setGradeSpan] = useState<GradeSpan>("3-12");
  const [providedLevel, setProvidedLevel] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing artifact…");
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptWords, setTranscriptWords] = useState<
    import("@/lib/asr/types").AsrWord[]
  >([]);
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false);
  const [transcriptEdited, setTranscriptEdited] = useState(false);
  const [asrMeta, setAsrMeta] = useState<{
    token: string;
    deliveryEvidence: string;
    metrics: import("@/lib/asr/types").FluencyMetrics;
    durationSeconds: number;
    meanConfidence: number;
    provider: string;
    wordCount: number;
  } | null>(null);
  const [listeningPlds, setListeningPlds] = useState<Record<
    "1" | "2" | "3" | "4",
    PldLevel
  > | null>(null);
  const [observationPayload, setObservationPayload] = useState<{
    observations: ObservationInput[];
    derivedLevel: number | null;
    coverageRatio: number;
    confidence: string;
    ready: boolean;
  } | null>(null);
  const [consentState, setConsentState] = useState<
    import("@/components/RecordingConsentPanel").RecordingConsentState | null
  >(null);
  const [consentLoading, setConsentLoading] = useState(false);

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

  useEffect(() => {
    setEvidenceKind(recommendedEvidenceKind(domain, gradeSpan));
    setRecording(null);
    setTranscriptWords([]);
    setTranscriptText("");
    setTranscriptConfirmed(false);
    setAsrMeta(null);
    setObservationPayload(null);
  }, [domain, gradeSpan]);

  useEffect(() => {
    if (domain !== "listening" || evidenceKind !== "observation_protocol") {
      setListeningPlds(null);
      return;
    }

    async function loadPlds() {
      try {
        const response = await apiFetch(
          `/api/elpac/plds?domain=listening&grade_span=${encodeURIComponent(gradeSpan)}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        setListeningPlds(data.plds);
      } catch {
        setListeningPlds(null);
      }
    }

    void loadPlds();
  }, [domain, evidenceKind, gradeSpan]);

  useEffect(() => {
    if (!studentUuid || evidenceKind !== "audio_recording") {
      setConsentState(null);
      setConsentLoading(false);
      return;
    }

    let cancelled = false;
    setConsentLoading(true);

    async function loadConsent() {
      try {
        const response = await apiFetch(
          `/api/students/${encodeURIComponent(studentUuid)}/recording-consent`,
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setConsentState(data);
        }
      } catch {
        if (!cancelled) {
          setConsentState(null);
        }
      } finally {
        if (!cancelled) {
          setConsentLoading(false);
        }
      }
    }

    void loadConsent();
    return () => {
      cancelled = true;
    };
  }, [studentUuid, evidenceKind]);

  const selectableKinds = selectableEvidenceKinds(domain);
  const requiresWrittenArtifact = evidenceKind === "written_artifact";
  const requiresAudio = evidenceKind === "audio_recording";
  const requiresObservation = evidenceKind === "observation_protocol";
  const evidenceBlocked =
    !isValidEvidence(domain, evidenceKind) ||
    (requiresAudio &&
      (!consentState?.consented || !consentState?.districtEnabled)) ||
    (requiresAudio && !transcriptConfirmed) ||
    (requiresObservation && !observationPayload?.ready);
  const audioCaptureDisabled =
    !studentUuid ||
    loading ||
    transcribing ||
    consentLoading ||
    !consentState?.districtEnabled ||
    !consentState?.consented;

  async function transcribeRecording() {
    if (!recording || !studentUuid) {
      setError("Select a student and record audio first.");
      return;
    }

    setTranscribing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("audio", recording.blob, recording.fileName);
      formData.append("student_uuid", studentUuid);
      formData.append("grade_span", gradeSpan);

      const response = await apiFetch("/api/analyze/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Transcription failed.",
        );
      }

      setTranscriptWords(data.words ?? []);
      setTranscriptText(data.transcript ?? "");
      setTranscriptConfirmed(false);
      setAsrMeta({
        token: data.asr_token,
        deliveryEvidence: data.delivery_evidence,
        metrics: data.metrics,
        durationSeconds: data.duration_seconds,
        meanConfidence: data.mean_confidence,
        provider: data.provider,
        wordCount: Array.isArray(data.words) ? data.words.length : 0,
      });
    } catch (transcribeError) {
      if (isDatabaseWakingError(transcribeError)) return;
      setError(
        transcribeError instanceof Error
          ? transcribeError.message
          : "Transcription failed.",
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (evidenceBlocked) {
      if (requiresAudio && !consentState?.consented) {
        setError("Record student consent before analyzing audio.");
      } else if (requiresAudio && !transcriptConfirmed) {
        setError("Confirm the transcript before analyzing.");
      } else if (requiresObservation) {
        setError("Complete the observation protocol before analyzing.");
      } else {
        setError("This domain and evidence combination is not supported.");
      }
      return;
    }

    if (!studentUuid) {
      setError("Please select a student.");
      return;
    }

    if (requiresWrittenArtifact && !file) {
      setError("Please upload an artifact.");
      return;
    }

    if (requiresAudio && !asrMeta) {
      setError("Transcribe and confirm the recording first.");
      return;
    }

    if (requiresObservation && !observationPayload?.ready) {
      setError("Complete the observation checklist first.");
      return;
    }

    if (file && file.size > MAX_SOURCE_ARTIFACT_BYTES) {
      setError(
        `File must be ${formatMegabytes(MAX_SOURCE_ARTIFACT_BYTES)} or smaller.`,
      );
      return;
    }

    if (requiresWrittenArtifact && file && isPdfFile(file) && selectedPages.length === 0) {
      setError("Select at least one PDF page containing student writing.");
      return;
    }

    if (requiresWrittenArtifact && file && selectedPages.length > MAX_PAGES_PER_ANALYSIS) {
      setError(`Select at most ${MAX_PAGES_PER_ANALYSIS} pages.`);
      return;
    }

    setLoading(true);
    setLoadingMessage("Preparing artifact…");

    try {
      const formData = new FormData();
      if (requiresWrittenArtifact && file) {
        const preparedFiles = await prepareArtifactForUpload(
          file,
          isPdfFile(file) ? { pdfPages: selectedPages } : undefined,
        );
        preparedFiles.forEach((preparedFile) => {
          formData.append("file", preparedFile);
        });
        formData.append("page_count", String(preparedFiles.length));
      }

      if (requiresAudio && asrMeta) {
        formData.append("transcript", transcriptText);
        formData.append("delivery_evidence", asrMeta.deliveryEvidence);
        formData.append("asr_token", asrMeta.token);
        formData.append("word_count", String(asrMeta.wordCount));
        formData.append("duration_seconds", String(asrMeta.durationSeconds));
        formData.append("mean_confidence", String(asrMeta.meanConfidence));
        formData.append("asr_provider", asrMeta.provider);
        formData.append("metrics", JSON.stringify(asrMeta.metrics));
        formData.append("transcript_edited", transcriptEdited ? "true" : "false");
      }

      if (requiresObservation && observationPayload?.ready) {
        formData.append(
          "observations",
          JSON.stringify(observationPayload.observations),
        );
      }

      formData.append("student_uuid", studentUuid);
      formData.append("domain", domain);
      formData.append("evidence_kind", evidenceKind);
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
        domain,
        evidenceKind,
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
            hidden={!requiresWrittenArtifact}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="domain" className={labelClassName}>
                ELPAC domain
              </label>
              <select
                id="domain"
                value={domain}
                onChange={(event) =>
                  setDomain(event.target.value as ElpacDomain)
                }
                className={selectClassName}
              >
                {ELPAC_DOMAINS.map((value) => (
                  <option key={value} value={value}>
                    {domainLabel(value)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="evidence_kind" className={labelClassName}>
                Evidence type
              </label>
              <select
                id="evidence_kind"
                value={evidenceKind}
                onChange={(event) =>
                  setEvidenceKind(event.target.value as EvidenceKind)
                }
                className={selectClassName}
              >
                {selectableKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {evidenceKindLabel(kind)}
                    {evidenceValidity(domain, kind) === "supporting"
                      ? " (supporting)"
                      : ""}
                  </option>
                ))}
              </select>
              {!isValidEvidence(domain, evidenceKind) ? (
                <p
                  className="mt-2 rounded-lg border border-accent-orange/30 bg-accent-orange/5 px-3 py-2 text-xs text-accent-orange"
                  role="note"
                >
                  This evidence type is not valid for the selected domain.
                </p>
              ) : null}
            </div>

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

          {requiresAudio ? (
            <div className="space-y-4">
              {studentUuid ? (
                <RecordingConsentPanel
                  studentUuid={studentUuid}
                  state={consentState}
                  loading={consentLoading}
                  onUpdated={setConsentState}
                />
              ) : (
                <p className="text-sm text-muted">
                  Select a student to check recording consent.
                </p>
              )}
              <AudioRecorder
                recording={recording}
                onRecordingReady={setRecording}
                disabled={audioCaptureDisabled}
              />
              <button
                type="button"
                className={btnSecondaryClassName}
                disabled={
                  !recording ||
                  transcribing ||
                  !studentUuid ||
                  audioCaptureDisabled
                }
                onClick={() => void transcribeRecording()}
              >
                {transcribing ? "Transcribing…" : "Transcribe recording"}
              </button>
              {transcriptText ? (
                <TranscriptReview
                  words={transcriptWords}
                  initialTranscript={transcriptText}
                  onConfirm={(text, edited) => {
                    setTranscriptText(text);
                    setTranscriptEdited(edited);
                    setTranscriptConfirmed(true);
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {requiresObservation && listeningPlds ? (
            <ObservationProtocol
              plds={listeningPlds}
              onChange={setObservationPayload}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading || previewLoading || evidenceBlocked}
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
