import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import {
  analyzeArtifactStream,
  ClaudeParseError,
} from "@/lib/claude/client";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import { recordAudit } from "@/lib/audit/log";
import {
  getRosterGradeInfo,
  insertSessionAndInsight,
} from "@/lib/db/queries";
import {
  bufferToBase64Image,
  rasterizePdfFirstPage,
} from "@/lib/pdf/rasterize";
import { flushPendingTraces } from "@/lib/langsmith/client";
import { GradeSpanSchema, type Insight } from "@/lib/types";
import {
  MAX_PAGES_PER_ANALYSIS,
  MAX_UPLOAD_BYTES,
} from "@/lib/artifact/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const gradeSpan = GradeSpanSchema.parse(gradeSpanRaw);
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

    const rosterInfo = await getRosterGradeInfo(teacher.id, studentUuid);

    if (!rosterInfo) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const exactGrade = rosterInfo.exact_grade;

    const images: ImagePayload[] = [];
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (event: AnalyzeStreamEvent) => {
          controller.enqueue(
            encoder.encode(`${JSON.stringify(event)}\n`),
          );
        };

        try {
          const insight = await analyzeArtifactStream(
            {
              images: images.map((image) => ({
                imageBase64: image.base64,
                mediaType: image.mediaType,
              })),
              gradeSpan,
              exactGrade,
              providedLevel,
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
            gradeSpan,
            exactGrade,
            providedElpacLevel: providedLevel,
            insight,
          });

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
