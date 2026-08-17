"use client";

import { useCallback, useMemo, useState } from "react";
import { RosterScoresExportModal } from "@/components/RosterScoresExportModal";
import { StudentGroupBoard } from "@/components/StudentGroupBoard";
import {
  StudentsExplorer,
  type StudentExplorerEntry,
} from "@/components/StudentsExplorer";
import { RequestGradeAccessForm } from "@/components/RequestGradeAccessForm";
import {
  btnUploadCsvClassName,
  tabButtonActiveClassName,
  tabButtonInactiveClassName,
  tabListClassName,
} from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

interface GroupData {
  id: string;
  name: string;
  position: number;
  members: { student_uuid: string; position: number }[];
}

export function StudentsPageClient({
  entries,
  initialGroups,
  initialHidden,
}: {
  entries: StudentExplorerEntry[];
  initialGroups: GroupData[];
  initialHidden: string[];
}) {
  const [mode, setMode] = useState<"browse" | "organize">("browse");
  const [groups, setGroups] = useState(initialGroups);
  const [hiddenUuids, setHiddenUuids] = useState(initialHidden);

  const refreshOrganize = useCallback(async () => {
    const [groupsRes, hiddenRes] = await Promise.all([
      apiFetch("/api/students/groups"),
      apiFetch("/api/students/hidden"),
    ]);
    if (groupsRes.ok) {
      const data = await groupsRes.json();
      setGroups(data.groups ?? []);
    }
    if (hiddenRes.ok) {
      const data = await hiddenRes.json();
      setHiddenUuids(data.hidden ?? []);
    }
  }, []);

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) => !hiddenUuids.includes(entry.student_uuid)),
    [entries, hiddenUuids],
  );

  const [browseExportEntries, setBrowseExportEntries] =
    useState<StudentExplorerEntry[] | null>(null);

  const exportEntries =
    mode === "browse" && browseExportEntries != null
      ? browseExportEntries
      : visibleEntries;

  const handleFilteredEntriesChange = useCallback(
    (filtered: StudentExplorerEntry[]) => {
      setBrowseExportEntries((previous) => {
        const previousKey = previous?.map((entry) => entry.student_uuid).join("\0");
        const nextKey = filtered.map((entry) => entry.student_uuid).join("\0");
        if (previousKey === nextKey) return previous;
        return filtered;
      });
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Students view" className={tabListClassName}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "browse"}
            className={
              mode === "browse"
                ? tabButtonActiveClassName
                : tabButtonInactiveClassName
            }
            onClick={() => setMode("browse")}
          >
            Browse
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "organize"}
            className={
              mode === "organize"
                ? tabButtonActiveClassName
                : tabButtonInactiveClassName
            }
            onClick={() => setMode("organize")}
          >
            Organize
          </button>
        </div>
        {entries.length > 0 ? (
          <RosterScoresExportModal
            entries={exportEntries}
            groups={groups}
            buttonClassName={btnUploadCsvClassName}
          />
        ) : null}
      </div>

      {entries.length === 0 ? <RequestGradeAccessForm /> : null}

      {mode === "browse" ? (
        <section className="ui-card p-6">
          <StudentsExplorer
            entries={visibleEntries}
            groups={groups}
            onFilteredEntriesChange={handleFilteredEntriesChange}
          />
        </section>
      ) : (
        <section className="ui-card p-6">
          <StudentGroupBoard
            entries={entries}
            initialGroups={groups}
            hiddenUuids={hiddenUuids}
            onRefresh={() => void refreshOrganize()}
          />
        </section>
      )}
    </div>
  );
}
