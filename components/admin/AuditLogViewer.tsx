"use client";

import { useCallback, useEffect, useState } from "react";
import { cardClassName, sectionTitleClassName } from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  occurred_at: string;
  authorized_by_type: string | null;
}

export function AuditLogViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await apiFetch("/api/admin/audit?limit=100");
    if (response.ok) {
      const data = await response.json();
      setRows(data.rows ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={cardClassName}>
      <h2 className={sectionTitleClassName}>Audit log</h2>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-brand-soft/80">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-soft bg-brand-soft/40 text-muted">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Auth source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-brand-soft/60 text-brand-dark last:border-0"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(row.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{row.action}</td>
                  <td className="px-4 py-3">
                    {row.resource_type}
                    {row.resource_id ? ` · ${row.resource_id.slice(0, 8)}…` : ""}
                  </td>
                  <td className="px-4 py-3">{row.authorized_by_type ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
