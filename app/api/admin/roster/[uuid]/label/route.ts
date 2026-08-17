import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import {
  rosterEntryInSchool,
  updateRosterEntryLabelBySchool,
} from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateLabelSchema = z.object({
  label: z.string().trim().min(1, "Student label is required").max(120),
});

async function patchHandler(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const { uuid } = await params;

  try {
    const body = UpdateLabelSchema.parse(await req.json());

    const inSchool = await rosterEntryInSchool(admin.school_id, uuid);
    if (!inSchool) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const updated = await updateRosterEntryLabelBySchool(
      admin.school_id,
      uuid,
      body.label,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update label" },
        { status: 400 },
      );
    }

    await recordAudit({
      actorId: admin.id,
      action: "roster.update_label",
      resourceType: "roster",
      resourceId: uuid,
      req,
      authorizedByType: "admin_role",
    });

    return NextResponse.json({ label: body.label });
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
    console.error("[api/admin/roster/[uuid]/label]", error);
    return NextResponse.json(
      { error: "Failed to update label" },
      { status: 400 },
    );
  }
}

export const PATCH = withDbGuard(patchHandler);
