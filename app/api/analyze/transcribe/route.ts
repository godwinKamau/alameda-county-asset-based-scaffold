import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { transcribeWithDeepgram } from "@/lib/asr/deepgram";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import {
  isStudentAccessResponse,
  requireStudentAccess,
} from "@/lib/auth/student-access";
import { recordAudit } from "@/lib/audit/log";
import {
  hasActiveRecordingConsent,
  isDistrictAudioRecordingEnabled,
} from "@/lib/db/queries";
import {
  ACCEPTED_AUDIO_MIME_TYPES,
  MAX_AUDIO_DURATION_SECONDS,
  MAX_AUDIO_UPLOAD_BYTES,
  MIN_AUDIO_DURATION_SECONDS,
} from "@/lib/audio/constants";
import {
  buildSignedAsrPayload,
  signAsrPayload,
} from "@/lib/speech/asr-token";
import { formatDeliveryEvidence } from "@/lib/speech/fluency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ACCEPTED_MIME = new Set<string>(ACCEPTED_AUDIO_MIME_TYPES);

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const formData = await req.formData();
    const studentUuid = formData.get("student_uuid");
    const gradeSpanRaw = formData.get("grade_span");
    const audio = formData.get("audio");

    if (typeof studentUuid !== "string" || !studentUuid) {
      return NextResponse.json(
        { error: "student_uuid is required" },
        { status: 400 },
      );
    }

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "audio is required" }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Audio file is too large." }, { status: 413 });
    }

    if (!ACCEPTED_MIME.has(audio.type) && !audio.name.match(/\.(webm|mp4|m4a|mp3|wav)$/i)) {
      return NextResponse.json(
        { error: "Unsupported audio format." },
        { status: 400 },
      );
    }

    const access = await requireStudentAccess(teacher, studentUuid);
    if (isStudentAccessResponse(access)) return access;

    const enabled = await isDistrictAudioRecordingEnabled(teacher.id);
    if (!enabled) {
      return NextResponse.json(
        { error: "Audio recording is not enabled for your district." },
        { status: 403 },
      );
    }

    const consented = await hasActiveRecordingConsent(studentUuid);
    if (!consented) {
      return NextResponse.json(
        { error: "Record student consent before transcribing audio." },
        { status: 403 },
      );
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const asr = await transcribeWithDeepgram(buffer, audio.type || "audio/webm");

    if (asr.durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
      return NextResponse.json(
        { error: `Recording exceeds ${MAX_AUDIO_DURATION_SECONDS} seconds.` },
        { status: 400 },
      );
    }

    if (asr.durationSeconds < MIN_AUDIO_DURATION_SECONDS) {
      return NextResponse.json(
        { error: `Recording must be at least ${MIN_AUDIO_DURATION_SECONDS} seconds.` },
        { status: 400 },
      );
    }

    const signed = buildSignedAsrPayload(asr);
    const token = signAsrPayload(signed);
    const gradeSpan =
      typeof gradeSpanRaw === "string" && gradeSpanRaw
        ? gradeSpanRaw
        : access.gradeSpan;

    await recordAudit({
      actorId: teacher.id,
      action: "analysis.transcribe",
      resourceType: "student",
      resourceId: studentUuid,
      req,
    });

    return NextResponse.json({
      transcript: asr.transcript,
      words: asr.words,
      duration_seconds: asr.durationSeconds,
      delivery_evidence: formatDeliveryEvidence(signed.metrics, gradeSpan),
      metrics: signed.metrics,
      asr_token: token,
      mean_confidence: asr.meanConfidence,
      provider: asr.provider,
    });
  } catch (error) {
    console.error("[api/analyze/transcribe]", error);
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 500 },
    );
  }
}

export const POST = withDbGuard(postHandler);
