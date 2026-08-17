"use client";

import { useCallback, useEffect, useState } from "react";
import { AddStudentForm } from "@/components/AddStudentForm";
import { RosterList, type RosterListEntry } from "@/components/RosterList";
import { RosterUploaderModal } from "@/components/RosterUploaderModal";
import { collectExistingSubjects } from "@/lib/roster/subject";
import { cardClassName, sectionTitleClassName } from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

const API_BASE = "/api/admin/roster";

export function SchoolRosterManager() {
  const [entries, setEntries] = useState<RosterListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(API_BASE);
      if (!response.ok) {
        setError("Failed to load school roster");
        return;
      }
      const data = await response.json();
      setEntries(data.entries ?? []);
    } catch {
      setError("Failed to load school roster");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const existingSubjects = collectExistingSubjects(
    entries.map((entry) => entry.subject),
  );

  return (
    <section className={cardClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionTitleClassName}>School roster</h2>
        <div className="flex flex-wrap gap-2">
          <RosterUploaderModal apiBase={API_BASE} onSuccess={() => void loadRoster()} />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        Upload, add, edit, and delete students for your school. Teachers access
        students through grade grants.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading roster…</p>
      ) : (
        <div className="mt-4 space-y-6">
          <AddStudentForm
            existingSubjects={existingSubjects}
            apiBase={API_BASE}
            onAdded={() => void loadRoster()}
          />
          <RosterList
            entries={entries}
            existingSubjects={existingSubjects}
            manageMode
            apiBase={API_BASE}
            onMutated={() => void loadRoster()}
          />
        </div>
      )}
    </section>
  );
}
