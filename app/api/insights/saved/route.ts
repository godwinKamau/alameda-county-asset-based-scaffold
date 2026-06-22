import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import {
  deleteScaffoldInsight,
  saveScaffoldInsight,
} from "@/lib/db/queries";
import { ScaffoldSourceSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SavedInsightBodySchema = z.object({
  sessionId: z.string().uuid(),
  itemIndex: z.number().int().min(0),
  text: z.string().min(1).optional(),
  sources: z.array(ScaffoldSourceSchema).optional(),
});

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = SavedInsightBodySchema.parse(await req.json());

    const saved = await saveScaffoldInsight(
      teacher.id,
      body.sessionId,
      body.itemIndex,
      body.text
        ? { text: body.text, sources: body.sources }
        : undefined,
    );

    if (!saved) {
      return NextResponse.json(
        { error: "Session or scaffold item not found" },
        { status: 404 },
      );
    }

    await recordAudit({
      actorId: teacher.id,
      action: "insight.save",
      resourceType: "saved_insight",
      resourceId: body.sessionId,
      req,
    });

    return NextResponse.json({ saved: true });
  } catch (error) {
    if (isDatabaseWakingError(error)) {
      return databaseWakingResponse();
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/insights/saved POST]", error);
    return NextResponse.json(
      { error: "Failed to save insight" },
      { status: 400 },
    );
  }
}

async function deleteHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = SavedInsightBodySchema.parse(await req.json());

    const deleted = await deleteScaffoldInsight(
      teacher.id,
      body.sessionId,
      body.itemIndex,
      body.text ? { text: body.text } : undefined,
    );

    if (!deleted) {
      return NextResponse.json(
        { error: "Saved insight not found" },
        { status: 404 },
      );
    }

    await recordAudit({
      actorId: teacher.id,
      action: "insight.unsave",
      resourceType: "saved_insight",
      resourceId: body.sessionId,
      req,
    });

    return NextResponse.json({ saved: false });
  } catch (error) {
    if (isDatabaseWakingError(error)) {
      return databaseWakingResponse();
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/insights/saved DELETE]", error);
    return NextResponse.json(
      { error: "Failed to unsave insight" },
      { status: 400 },
    );
  }
}

export const POST = withDbGuard(postHandler);
export const DELETE = withDbGuard(deleteHandler);
