import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { ClaudeParseError, remixScaffold, remixScaffoldItem } from "@/lib/claude/client";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import {
  getRosterGradeInfo,
  getSessionWithInsight,
} from "@/lib/db/queries";
import { distributeScaffoldSources } from "@/lib/framework/sources";
import { parseScaffoldItems } from "@/lib/scaffold/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RemixBodySchema = z.object({
  sessionId: z.string().uuid(),
  itemIndex: z.number().int().min(0).optional(),
  priorRemixTexts: z.array(z.string().min(1)).max(5).optional(),
});

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = RemixBodySchema.parse(await req.json());

    const session = await getSessionWithInsight(teacher.id, body.sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const rosterInfo = await getRosterGradeInfo(
      teacher.id,
      session.student_uuid,
    );

    const remixInput = {
      gradeSpan: session.grade_span,
      exactGrade: rosterInfo?.exact_grade ?? null,
      estimatedLevel: session.insight.estimated_level,
      strengths: session.insight.strengths,
      levelReasoning: session.insight.level_reasoning,
      gapToNext: session.insight.gap_to_next,
      originalScaffold: session.insight.scaffold,
      originalSources: session.insight.scaffold_sources,
      priorRemixTexts: body.priorRemixTexts,
    };

    let result;

    if (body.itemIndex != null) {
      const items = parseScaffoldItems(session.insight.scaffold);
      const originalItem = items[body.itemIndex];

      if (!originalItem) {
        return NextResponse.json(
          { error: "Scaffold item not found" },
          { status: 400 },
        );
      }

      const sourcesByItem = distributeScaffoldSources(
        items.length,
        session.insight.scaffold_sources ?? [],
      );

      result = await remixScaffoldItem({
        ...remixInput,
        originalItem,
        originalItemSources: sourcesByItem[body.itemIndex] ?? [],
      });
    } else {
      result = await remixScaffold(remixInput);
    }

    await recordAudit({
      actorId: teacher.id,
      action: "insight.remix",
      resourceType: "analysis_session",
      resourceId: body.sessionId,
      req,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isDatabaseWakingError(error)) {
      return databaseWakingResponse();
    }
    if (error instanceof ClaudeParseError) {
      console.error("[api/insights/remix] Claude parse error");
      return NextResponse.json(
        {
          error:
            "We could not generate an alternative scaffold. Please try again.",
        },
        { status: 502 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/insights/remix]", error);
    return NextResponse.json(
      { error: "Failed to generate alternative scaffold" },
      { status: 500 },
    );
  }
}

export const POST = withDbGuard(postHandler);
