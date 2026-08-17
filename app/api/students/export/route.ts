import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { recordAudit } from "@/lib/audit/log";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExportAuditSchema = z.object({
  scrub_names: z.boolean().optional().default(false),
  row_count: z.number().int().min(0).optional(),
});

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = ExportAuditSchema.parse(await req.json());

    await recordAudit({
      actorId: teacher.id,
      action: body.scrub_names ? "roster.export.scrubbed" : "roster.export.named",
      resourceType: "roster",
      resourceId: null,
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid export request" },
        { status: 400 },
      );
    }
    throw error;
  }
}

export const POST = withDbGuard(postHandler);
