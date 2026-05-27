import "server-only";

import { createHash } from "crypto";
import { getPool } from "@/lib/db/pool";

export function hashIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const raw = forwarded?.split(",")[0]?.trim() ?? realIp ?? "";
  return createHash("sha256").update(raw).digest("hex");
}

export interface RecordAuditInput {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  req: Request;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO audit_log (actor_id, action, resource_type, resource_id, ip_hash)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.actorId,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      hashIp(input.req),
    ],
  );
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}
