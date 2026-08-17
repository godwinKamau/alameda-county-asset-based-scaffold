import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import {
  analyzeArtifactStream,
  ClaudeParseError,
} from "@/lib/claude/client";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import {
  isStudentAccessResponse,
  requireStudentAccess,
} from "@/lib/auth/student-access";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import { recordAudit } from "@/lib/audit/log";
import {
  insertObservationRecord,
  insertSessionAndInsight,
  insertSessionTranscript,
} from "@/lib/db/queries";
import {
  bufferToBase64Image,
  rasterizePdfFirstPage,
} from "@/lib/pdf/rasterize";
import { flushPendingTraces } from "@/lib/langsmith/client";
import { DomainSchema } from "@/lib/elpac/domain";
import {
  EvidenceKindSchema,
  isValidEvidence,
} from "@/lib/elpac/evidence";
import { getPldsForDomainAndSpan } from "@/lib/elpac/loader";
import {
  deriveObservationLevel,
  deriveProtocolFromPlds,
  formatObservationSummary,
  PROTOCOL_VERSION,
  type ObservationInput,
} from "@/lib/elpac/observation";
import {
  type SignedAsrPayload,
  verifyAsrToken,
} from "@/lib/speech/asr-token";
import type { AsrResult, FluencyMetrics } from "@/lib/asr/types";
import type { Insight } from "@/lib/types";
import {
  MAX_PAGES_PER_ANALYSIS,
  MAX_UPLOAD_BYTES,
} from "@/lib/artifact/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type ImagePayload = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

async function fileToImagePayload(file: File): Promise<ImagePayload> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    return rasterizePdfFirstPage(buffer);
  }

  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    return bufferToBase64Image(buffer, file.type);
  }

  throw new Error("Unsupported file type");
}

type AnalyzeStreamEvent =
  | { type: "stage"; stage: "preparing" | "transcribing" | "analyzing" }
  | { type: "snapshot"; insight: Partial<Insight> }
  | { type: "complete"; sessionId: string; insight: Insight }
  | { type: "error"; message: string };

function analyzeErrorMessage(error: unknown): string {
  if (error instanceof ClaudeParseError) {
    return "We could not analyze this artifact. Please try again with a clearer image.";
  }
  if (isDatabaseWakingError(error)) {
    return "The database is starting up after sleeping. Please try again in a moment.";
  }
  return "Analysis failed. Please try again.";
}

function parseObservations(raw: FormDataEntryValue | null): ObservationInput[] {
  if (typeof raw !== "string" || !raw) {
    throw new Error("observations payload is required");
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("observations must be an array");
  }
  return parsed as ObservationInput[];
}

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "Upload too large or unreadable. The browser should optimize files before upload — try again or use a smaller scan.",
        },
        { status: 413 },
      );
    }

    const files = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File);

    const studentUuid = formData.get("student_uuid");
    const gradeSpanRaw = formData.get("grade_span");
    const providedLevelRaw = formData.get("provided_elpac_level");
    const domainRaw = formData.get("domain");
    const evidenceKindRaw = formData.get("evidence_kind");

    const domain = DomainSchema.parse(
      typeof domainRaw === "string" && domainRaw ? domainRaw : "writing",
    );

    const evidenceKind = EvidenceKindSchema.parse(
      typeof evidenceKindRaw === "string" && evidenceKindRaw
        ? evidenceKindRaw
        : "written_artifact",
    );

    if (!isValidEvidence(domain, evidenceKind)) {
      return NextResponse.json(
        { error: "Invalid domain and evidence type combination." },
        { status: 400 },
      );
    }

    if (typeof studentUuid !== "string" || !studentUuid) {
      return NextResponse.json(
        { error: "student_uuid is required" },
        { status: 400 },
      );
    }

    if (typeof gradeSpanRaw !== "string") {
      return NextResponse.json(
        { error: "grade_span is required" },
        { status: 400 },
      );
    }

    const providedLevel =
      typeof providedLevelRaw === "string" && providedLevelRaw
        ? Number.parseInt(providedLevelRaw, 10)
        : null;

    if (
      providedLevel != null &&
      (Number.isNaN(providedLevel) || providedLevel < 1 || providedLevel > 4)
    ) {
      return NextResponse.json(
        { error: "provided_elpac_level must be 1-4" },
        { status: 400 },
      );
    }

    const access = await requireStudentAccess(teacher, studentUuid);
    if (isStudentAccessResponse(access)) return access;

    const gradeSpan = access.gradeSpan;
    const exactGrade = access.exactGrade;

    const images: ImagePayload[] = [];
    let transcript: string | undefined;
    let deliveryEvidence: string | undefined;
    let derivedLevel: number | undefined;
    let observationSummary: string | undefined;
    let observationPayload: ObservationInput[] | undefined;
    let observationMeta:
      | { coverageRatio: number; confidence: string; contextNote?: string }
      | undefined;
    let signedAsr:
      | { asr: AsrResult; metrics: FluencyMetrics; editedByTeacher: boolean }
      | undefined;

    if (evidenceKind === "written_artifact") {
      if (files.length === 0) {
        return NextResponse.json({ error: "File is required" }, { status: 400 });
      }

      if (files.length > MAX_PAGES_PER_ANALYSIS) {
        return NextResponse.json(
          { error: `At most ${MAX_PAGES_PER_ANALYSIS} pages may be analyzed.` },
          { status: 400 },
        );
      }

      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      if (totalBytes > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          {
            error:
              "Optimized upload is still too large. Reload the page and try again, or select fewer pages.",
          },
          { status: 413 },
        );
      }

      for (const file of files) {
        try {
          images.push(await fileToImagePayload(file));
        } catch {
          return NextResponse.json(
            { error: "File must be JPG, PNG, GIF, WEBP, or PDF" },
            { status: 400 },
          );
        }
      }
    } else if (evidenceKind === "audio_recording") {
      transcript = String(formData.get("transcript") ?? "").trim();
      deliveryEvidence = String(formData.get("delivery_evidence") ?? "").trim();
      const asrToken = String(formData.get("asr_token") ?? "");
      const durationSeconds = Number(formData.get("duration_seconds") ?? 0);
      const meanConfidence = Number(formData.get("mean_confidence") ?? 0);
      const provider = String(formData.get("asr_provider") ?? "deepgram");
      const wordCount = Number(formData.get("word_count") ?? 0);
      const editedByTeacher = formData.get("transcript_edited") === "true";

      if (!transcript || !asrToken || !deliveryEvidence) {
        return NextResponse.json(
          { error: "Confirmed transcript and ASR token are required." },
          { status: 400 },
        );
      }

      if (!Number.isFinite(wordCount) || wordCount <= 0) {
        return NextResponse.json(
          { error: "ASR word count is required." },
          { status: 400 },
        );
      }

      const metricsRaw = formData.get("metrics");
      let metrics: FluencyMetrics;
      try {
        metrics = JSON.parse(String(metricsRaw)) as FluencyMetrics;
      } catch {
        return NextResponse.json(
          { error: "Invalid fluency metrics payload." },
          { status: 400 },
        );
      }

      const payload: SignedAsrPayload = {
        asr: {
          words: [],
          transcript,
          durationSeconds,
          meanConfidence,
          provider,
          model: "nova-3",
        },
        metrics,
      };

      if (!verifyAsrToken(payload, asrToken, wordCount)) {
        return NextResponse.json(
          { error: "Invalid or expired transcription token." },
          { status: 400 },
        );
      }

      signedAsr = {
        asr: payload.asr,
        metrics: payload.metrics,
        editedByTeacher,
      };
    } else if (evidenceKind === "observation_protocol") {
      observationPayload = parseObservations(formData.get("observations"));
      const contextNote = String(formData.get("context_note") ?? "").trim();
      const plds = getPldsForDomainAndSpan(domain, gradeSpan);
      const protocol = deriveProtocolFromPlds(plds);
      const levelResult = deriveObservationLevel(protocol, observationPayload);

      if (levelResult.level == null) {
        return NextResponse.json(
          {
            error:
              levelResult.reason === "insufficient_coverage"
                ? "Check more descriptors before submitting."
                : "Could not derive a listening level from the observation.",
          },
          { status: 400 },
        );
      }

      derivedLevel = levelResult.level;
      observationSummary = formatObservationSummary(
        protocol,
        observationPayload,
        derivedLevel,
      );
      observationMeta = {
        coverageRatio: levelResult.coverageRatio,
        confidence: levelResult.confidence,
        contextNote: contextNote || undefined,
      };
    } else {
      return NextResponse.json(
        { error: "This evidence type is not yet supported." },
        { status: 400 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (event: AnalyzeStreamEvent) => {
          controller.enqueue(
            encoder.encode(`${JSON.stringify(event)}\n`),
          );
        };

        try {
          enqueue({ type: "stage", stage: "preparing" });
          enqueue({ type: "stage", stage: "analyzing" });

          const insight = await analyzeArtifactStream(
            {
              images: images.map((image) => ({
                imageBase64: image.base64,
                mediaType: image.mediaType,
              })),
              domain,
              evidenceKind,
              gradeSpan,
              exactGrade,
              providedLevel,
              transcript,
              deliveryEvidence,
              derivedLevel,
              observationSummary,
            },
            {
              onSnapshot: (snapshot) => {
                enqueue({ type: "snapshot", insight: snapshot });
              },
            },
          );

          const { sessionId } = await insertSessionAndInsight({
            teacherId: teacher.id,
            studentUuid,
            domain,
            evidenceKind,
            gradeSpan,
            exactGrade,
            providedElpacLevel: providedLevel,
            insight,
          });

          if (signedAsr && transcript) {
            const retentionDays = Number.parseInt(
              process.env.TRANSCRIPT_RETENTION_DAYS ?? "180",
              10,
            );
            if (retentionDays !== 0) {
              await insertSessionTranscript({
                sessionId,
                transcript,
                editedByTeacher: signedAsr.editedByTeacher,
                fluencyMetrics: signedAsr.metrics,
                asrProvider: signedAsr.asr.provider,
                asrMeanConfidence: signedAsr.asr.meanConfidence,
                durationSeconds: signedAsr.asr.durationSeconds,
                retentionDays,
              });
            }
          }

          if (observationPayload && observationMeta && derivedLevel != null) {
            await insertObservationRecord({
              sessionId,
              protocolVersion: PROTOCOL_VERSION,
              observations: observationPayload,
              derivedLevel,
              coverageRatio: observationMeta.coverageRatio,
              confidence: observationMeta.confidence,
              contextNote: observationMeta.contextNote,
            });
          }

          await recordAudit({
            actorId: teacher.id,
            action: "analysis.create",
            resourceType: "analysis_session",
            resourceId: sessionId,
            req,
          });

          enqueue({ type: "complete", sessionId, insight });
          controller.close();
        } catch (error) {
          if (error instanceof ClaudeParseError) {
            console.error("[api/analyze] Claude parse error");
          } else if (!isDatabaseWakingError(error)) {
            console.error("[api/analyze]", error);
          }
          enqueue({ type: "error", message: analyzeErrorMessage(error) });
          controller.close();
        } finally {
          await flushPendingTraces();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isDatabaseWakingError(error)) {
      return databaseWakingResponse();
    }

    console.error("[api/analyze]", error);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 },
    );
  }
}

export const POST = withDbGuard(postHandler);
