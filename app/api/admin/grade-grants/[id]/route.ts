import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { revokeGrant } from "@/lib/db/grade-grants";
import { getPool } from "@/lib/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function deleteHandler(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const { id } = await context.params;

  const pool = getPool();
  const grantRow = await pool.query<{ school_id: string }>(
    `SELECT school_id FROM grade_grants WHERE id = $1`,
    [id],
  );
  if (!grantRow.rows[0] || grantRow.rows[0].school_id !== admin.school_id) {
    return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  }

  const revoked = await revokeGrant(admin.id, id);
  if (!revoked) {
    return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  }

  await recordAudit({
    actorId: admin.id,
    action: "grade_grant.revoke",
    resourceType: "grade_grant",
    resourceId: id,
    req,
  });

  return NextResponse.json({ ok: true });
}

export const DELETE = withDbGuard(deleteHandler);
