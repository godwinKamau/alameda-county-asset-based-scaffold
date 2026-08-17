import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { decideRequest } from "@/lib/db/grade-grants";
import { getPool } from "@/lib/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DecideSchema = z.object({
  decision: z.enum(["approved", "denied"]),
  expires_at: z.string().datetime().nullable().optional(),
  decision_note: z.string().trim().max(500).nullable().optional(),
});

async function postHandler(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const { id } = await context.params;

  const pool = getPool();
  const requestRow = await pool.query<{ school_id: string }>(
    `SELECT school_id FROM grade_access_requests WHERE id = $1`,
    [id],
  );
  if (!requestRow.rows[0] || requestRow.rows[0].school_id !== admin.school_id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    const body = DecideSchema.parse(await req.json());
    const result = await decideRequest(admin.id, id, {
      decision: body.decision,
      expiresAt: body.expires_at ? new Date(body.expires_at) : null,
      decisionNote: body.decision_note ?? null,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Request not found or already decided" },
        { status: 404 },
      );
    }

    await recordAudit({
      actorId: admin.id,
      action:
        body.decision === "approved"
          ? "access_request.approve"
          : "access_request.deny",
      resourceType: "access_request",
      resourceId: id,
      req,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    console.error("[api/admin/access-requests/[id]]", error);
    return NextResponse.json(
      { error: "Failed to decide access request" },
      { status: 500 },
    );
  }
}

export const POST = withDbGuard(postHandler);
