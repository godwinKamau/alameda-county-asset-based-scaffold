"use client";

import { useState } from "react";
import { AccessRequestQueue } from "@/components/admin/AccessRequestQueue";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { GradeGrantManager } from "@/components/admin/GradeGrantManager";
import { MissingGradeQueue } from "@/components/admin/MissingGradeQueue";
import { SchoolRosterManager } from "@/components/admin/SchoolRosterManager";
import { TeacherRoleManager } from "@/components/admin/TeacherRoleManager";
import {
  tabButtonActiveClassName,
  tabButtonInactiveClassName,
  tabListClassName,
} from "@/lib/ui/styles";

type AdminTab = "access" | "roster";

interface AdminPanelProps {
  missingGradeCount: number;
  schoolId: string;
  currentTeacherId: string;
}

export function AdminPanel({
  missingGradeCount,
  schoolId,
  currentTeacherId,
}: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>("access");

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Admin sections" className={tabListClassName}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "access"}
          className={
            tab === "access"
              ? tabButtonActiveClassName
              : tabButtonInactiveClassName
          }
          onClick={() => setTab("access")}
        >
          Grant access
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "roster"}
          className={
            tab === "roster"
              ? tabButtonActiveClassName
              : tabButtonInactiveClassName
          }
          onClick={() => setTab("roster")}
        >
          School roster
        </button>
      </div>

      {tab === "access" ? (
        <div role="tabpanel" className="space-y-6">
          <MissingGradeQueue initialCount={missingGradeCount} />
          <GradeGrantManager defaultSchoolId={schoolId} />
          <AccessRequestQueue />
          <TeacherRoleManager currentTeacherId={currentTeacherId} />
          <AuditLogViewer />
        </div>
      ) : (
        <div role="tabpanel">
          <SchoolRosterManager />
        </div>
      )}
    </div>
  );
}
