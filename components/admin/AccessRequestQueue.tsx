"use client";

import { useCallback, useEffect, useState } from "react";
import {
  btnPrimaryClassName,
  btnSecondaryClassName,
  cardClassName,
  inputClassName,
  sectionTitleClassName,
} from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

interface AccessRequestRow {
  id: string;
  teacher_id: string;
  teacher_name: string | null;
  exact_grade: string | null;
  reason: string | null;
  requested_at: string;
}

export function AccessRequestQueue() {
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/admin/access-requests");
      if (!response.ok) {
        setError("Failed to load pending requests");
        return;
      }
      const data = await response.json();
      setRequests(data.requests ?? []);
    } catch {
      setError("Failed to load pending requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function handleDecide(
    requestId: string,
    decision: "approved" | "denied",
  ) {
    setDecidingId(requestId);
    setError(null);

    try {
      const response = await apiFetch(
        `/api/admin/access-requests/${requestId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            expires_at: expiresAt[requestId]
              ? new Date(expiresAt[requestId]).toISOString()
              : null,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Failed to decide request");
        return;
      }

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      setError("Failed to decide request");
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <section className={cardClassName}>
      <h2 className={sectionTitleClassName}>Pending access requests</h2>
      <p className="mt-2 text-sm text-muted">
        Teachers request grade access here. Approve to create a grant, or deny
        to close the request.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No pending requests.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-xl border border-brand-soft/80 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-dark">
                    {request.teacher_name ??
                      `Teacher ${request.teacher_id.slice(0, 8)}`}
                  </p>
                  <p className="text-sm text-muted">
                    {request.exact_grade
                      ? `Grade ${request.exact_grade}`
                      : "Whole school"}{" "}
                    · requested{" "}
                    {new Date(request.requested_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {request.reason ? (
                <p className="mt-2 text-sm text-brand-dark">{request.reason}</p>
              ) : null}
              <label className="mt-3 block text-sm">
                <span className="font-medium text-brand-dark">
                  Expires on approval (optional)
                </span>
                <input
                  type="datetime-local"
                  className={`${inputClassName} mt-1 w-full max-w-xs`}
                  value={expiresAt[request.id] ?? ""}
                  onChange={(e) =>
                    setExpiresAt((prev) => ({
                      ...prev,
                      [request.id]: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnPrimaryClassName}
                  disabled={decidingId === request.id}
                  onClick={() => void handleDecide(request.id, "approved")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={btnSecondaryClassName}
                  disabled={decidingId === request.id}
                  onClick={() => void handleDecide(request.id, "denied")}
                >
                  Deny
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
