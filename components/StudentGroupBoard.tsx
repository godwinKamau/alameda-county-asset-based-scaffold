"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { StudentExplorerEntry } from "@/components/StudentsExplorer";
import { resolveDisplayName } from "@/lib/roster/group";
import {
  btnPrimaryClassName,
  btnSecondaryClassName,
  inputClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

interface GroupData {
  id: string;
  name: string;
  position: number;
  members: { student_uuid: string; position: number }[];
}

function SortableStudent({
  entry,
  onMove,
  groups,
  children,
}: {
  entry: StudentExplorerEntry;
  groups: GroupData[];
  onMove: (studentUuid: string, groupId: string | null) => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: entry.student_uuid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = resolveDisplayName(entry);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-soft/80 bg-white px-3 py-2"
    >
      <button
        type="button"
        className="cursor-grab text-muted"
        aria-label={`Reorder ${displayName}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="min-w-0 flex-1 text-sm font-medium text-brand-dark">
        {displayName}
      </span>
      <label className="sr-only" htmlFor={`move-${entry.student_uuid}`}>
        Move {displayName} to group
      </label>
      <select
        id={`move-${entry.student_uuid}`}
        className={selectClassName}
        defaultValue=""
        onChange={(event) => {
          const value = event.target.value;
          onMove(entry.student_uuid, value || null);
          event.target.value = "";
        }}
      >
        <option value="">Move to group…</option>
        <option value="__ungrouped__">Ungrouped</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      {children}
    </li>
  );
}

export function StudentGroupBoard({
  entries,
  initialGroups,
  hiddenUuids,
  onRefresh,
}: {
  entries: StudentExplorerEntry[];
  initialGroups: GroupData[];
  hiddenUuids: string[];
  onRefresh: () => void;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [newGroupName, setNewGroupName] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  const visibleEntries = useMemo(
    () =>
      entries.filter(
        (entry) => showHidden || !hiddenUuids.includes(entry.student_uuid),
      ),
    [entries, hiddenUuids, showHidden],
  );

  const entryByUuid = useMemo(
    () => new Map(visibleEntries.map((entry) => [entry.student_uuid, entry])),
    [visibleEntries],
  );

  const grouped = useMemo(() => {
    const assigned = new Set<string>();
    const sections = groups.map((group) => {
      const members = group.members
        .map((member) => entryByUuid.get(member.student_uuid))
        .filter((entry): entry is StudentExplorerEntry => !!entry);
      members.forEach((entry) => assigned.add(entry.student_uuid));
      return { group, members };
    });
    const ungrouped = visibleEntries.filter(
      (entry) => !assigned.has(entry.student_uuid),
    );
    return { sections, ungrouped };
  }, [groups, visibleEntries, entryByUuid]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const moveStudent = useCallback(
    async (studentUuid: string, groupId: string | null) => {
      const resolvedGroupId = groupId === "__ungrouped__" ? null : groupId;
      await apiFetch("/api/students/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_uuid: studentUuid,
          group_id: resolvedGroupId,
          position: 0,
        }),
      });
      onRefresh();
    },
    [onRefresh],
  );

  async function handleCreateGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!newGroupName.trim()) return;
    await apiFetch("/api/students/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setNewGroupName("");
    onRefresh();
  }

  async function toggleHidden(studentUuid: string, hidden: boolean) {
    await apiFetch("/api/students/hidden", {
      method: hidden ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_uuid: studentUuid }),
    });
    onRefresh();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    void moveStudent(String(active.id), String(over.id).startsWith("group-")
      ? String(over.id).replace("group-", "")
      : null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(event) => setShowHidden(event.target.checked)}
          />
          Show hidden students
        </label>
      </div>

      <form onSubmit={(e) => void handleCreateGroup(e)} className="flex gap-2">
        <input
          className={inputClassName}
          value={newGroupName}
          onChange={(event) => setNewGroupName(event.target.value)}
          placeholder="New group name"
          maxLength={80}
        />
        <button type="submit" className={btnPrimaryClassName}>
          Add group
        </button>
      </form>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {grouped.sections.map(({ group, members }) => (
          <section key={group.id} className="space-y-2">
            <h3 className="text-sm font-semibold text-brand-dark">{group.name}</h3>
            <SortableContext
              items={members.map((entry) => entry.student_uuid)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {members.map((entry) => (
                  <SortableStudent
                    key={entry.student_uuid}
                    entry={entry}
                    groups={groups}
                    onMove={moveStudent}
                  />
                ))}
              </ul>
            </SortableContext>
          </section>
        ))}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-dark">Ungrouped</h3>
          <SortableContext
            items={grouped.ungrouped.map((entry) => entry.student_uuid)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {grouped.ungrouped.map((entry) => (
                <SortableStudent
                  key={entry.student_uuid}
                  entry={entry}
                  groups={groups}
                  onMove={moveStudent}
                >
                  <button
                    type="button"
                    className={btnSecondaryClassName}
                    onClick={() =>
                      void toggleHidden(
                        entry.student_uuid,
                        !hiddenUuids.includes(entry.student_uuid),
                      )
                    }
                  >
                    {hiddenUuids.includes(entry.student_uuid)
                      ? "Unhide"
                      : "Hide"}
                  </button>
                </SortableStudent>
              ))}
            </ul>
          </SortableContext>
        </section>
      </DndContext>
    </div>
  );
}
