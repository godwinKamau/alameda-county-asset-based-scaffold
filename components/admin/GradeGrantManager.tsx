"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExactGrade } from "@/lib/types";
import { EXACT_GRADES } from "@/lib/roster/grade";
import {
  btnPrimaryClassName,
  cardClassName,
  inputClassName,
  sectionTitleClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

interface GradeGrantRow {
  id: string;
  teacher_id: string;
  teacher_name: string | null;
  exact_grade: ExactGrade | null;
  granted_at: string;
  expires_at: string | null;
  origin: string;
  note: string | null;
}

interface TeacherOption {
  id: string;
  role: string;
  name: string;
}

export function GradeGrantManager({
  defaultSchoolId,
}: {
  defaultSchoolId: string;
}) {
  const [schoolId] = useState(defaultSchoolId);
  const [grants, setGrants] = useState<GradeGrantRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [exactGrade, setExactGrade] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadGrants = useCallback(async () => {
    const response = await apiFetch(
      `/api/admin/grade-grants?school_id=${encodeURIComponent(schoolId)}`,
    );
    if (!response.ok) return;
    const data = await response.json();
    setGrants(data.grants ?? []);
    setTeachers(data.teachers ?? []);
  }, [schoolId]);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants]);

  async function handleCreateGrant(event: React.FormEvent) {
    event.preventDefault();
    if (!teacherId) return;
    setError(null);

    const response = await apiFetch("/api/admin/grade-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacher_id: teacherId,
        school_id: schoolId,
        exact_grade: exactGrade || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        note: note.trim() || null,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to create grant");
      return;
    }

    setTeacherId("");
    setExactGrade("");
    setExpiresAt("");
    setNote("");
    await loadGrants();
  }

  async function handleRevoke(grantId: string) {
    setError(null);
    const response = await apiFetch(`/api/admin/grade-grants/${grantId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Failed to revoke grant");
      return;
    }
    await loadGrants();
  }

  return (
    <section className={cardClassName}>
      <h2 className={sectionTitleClassName}>Grade access grants</h2>
      <p className="mt-2 text-sm text-muted">
        Grant teachers access to analyze students in a specific grade or across
        the whole school.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => void handleCreateGrant(event)}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="block text-sm">
          <span className="font-medium text-brand-dark">Teacher</span>
          <select
            className={`${selectClassName} mt-1 w-full`}
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            required
          >
            <option value="">Select teacher…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.role})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-brand-dark">Grade scope</span>
          <select
            className={`${selectClassName} mt-1 w-full`}
            value={exactGrade}
            onChange={(e) => setExactGrade(e.target.value)}
          >
            <option value="">Whole school</option>
            {EXACT_GRADES.map((g) => (
              <option key={g} value={g}>
                Grade {g === "K" ? "K" : g}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-brand-dark">Expires (optional)</span>
          <input
            type="datetime-local"
            className={`${inputClassName} mt-1 w-full`}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-brand-dark">Note (optional)</span>
          <input
            type="text"
            className={`${inputClassName} mt-1 w-full`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className={btnPrimaryClassName}>
            Grant access
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-brand-soft/80">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-brand-soft bg-brand-soft/40 text-muted">
              <th className="px-4 py-3 font-medium">Teacher</th>
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium">Origin</th>
              <th className="px-4 py-3 font-medium">Granted</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {grants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted">
                  No active grants.
                </td>
              </tr>
            ) : (
              grants.map((grant) => (
                <tr
                  key={grant.id}
                  className="border-b border-brand-soft/60 text-brand-dark last:border-0"
                >
                  <td className="px-4 py-3">
                    {grant.teacher_name ?? grant.teacher_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    {grant.exact_grade
                      ? `Grade ${grant.exact_grade}`
                      : "Whole school"}
                  </td>
                  <td className="px-4 py-3 capitalize">{grant.origin}</td>
                  <td className="px-4 py-3">
                    {new Date(grant.granted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {grant.expires_at
                      ? new Date(grant.expires_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-sm font-medium text-error hover:underline"
                      onClick={() => void handleRevoke(grant.id)}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
