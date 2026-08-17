"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeacherRole } from "@/lib/types";
import {
  cardClassName,
  sectionTitleClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

interface TeacherRow {
  id: string;
  role: TeacherRole;
  name: string;
}

export function TeacherRoleManager({
  currentTeacherId,
}: {
  currentTeacherId: string;
}) {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await apiFetch("/api/admin/grade-grants");
    if (!response.ok) return;
    const data = await response.json();
    setTeachers(
      (data.teachers ?? []).map(
        (teacher: { id: string; role: TeacherRole; name: string }) => ({
          id: teacher.id,
          role: teacher.role,
          name: teacher.name,
        }),
      ),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateRole(teacherId: string, role: TeacherRole) {
    setError(null);
    const response = await apiFetch(`/api/admin/teachers/${teacherId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to update role");
      return;
    }
    await load();
  }

  return (
    <section className={cardClassName}>
      <h2 className={sectionTitleClassName}>Teacher roles</h2>
      <p className="mt-2 text-sm text-muted">
        Promote teachers to administrator or ELD coordinator. You cannot change
        your own role or demote the last admin.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 overflow-x-auto rounded-xl border border-brand-soft/80">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-brand-soft bg-brand-soft/40 text-muted">
              <th className="px-4 py-3 font-medium">Teacher</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr
                key={teacher.id}
                className="border-b border-brand-soft/60 text-brand-dark last:border-0"
              >
                <td className="px-4 py-3">
                  {teacher.name}
                  {teacher.id === currentTeacherId ? " (you)" : ""}
                </td>
                <td className="px-4 py-3">
                  <select
                    className={selectClassName}
                    value={teacher.role}
                    disabled={teacher.id === currentTeacherId}
                    onChange={(event) =>
                      void updateRole(
                        teacher.id,
                        event.target.value as TeacherRole,
                      )
                    }
                  >
                    <option value="teacher">Teacher</option>
                    <option value="eld_coordinator">ELD coordinator</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
