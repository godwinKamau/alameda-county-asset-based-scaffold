import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { listAuditLog } from "@/lib/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const rows = await listAuditLog(admin.school_id, { limit, offset });

  await recordAudit({
    actorId: admin.id,
    action: "admin.audit.view",
    resourceType: "admin",
    resourceId: admin.id,
    req,
    authorizedByType: "admin_role",
  });

  return NextResponse.json({ rows });
}

export const GET = withDbGuard(getHandler);
