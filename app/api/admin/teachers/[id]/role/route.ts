import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { setTeacherRole } from "@/lib/db/admin";
import { TeacherRoleSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RoleSchema = z.object({
  role: TeacherRoleSchema,
});

async function patchHandler(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const { id } = await context.params;

  try {
    const body = RoleSchema.parse(await req.json());
    const result = await setTeacherRole(
      admin.id,
      admin.school_id,
      id,
      body.role,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    await recordAudit({
      actorId: admin.id,
      action: "admin.role.change",
      resourceType: "teacher_account",
      resourceId: id,
      req,
      authorizedByType: "admin_role",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export const PATCH = withDbGuard(patchHandler);
