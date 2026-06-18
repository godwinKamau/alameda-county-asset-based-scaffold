"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewAnalysisIcon } from "@/components/NewAnalysisIcon";
import { RosterUploaderModal } from "@/components/RosterUploaderModal";
import {
  btnDashboardActionClassName,
  btnUploadCsvClassName,
} from "@/lib/ui/styles";

export function DashboardHeaderActions() {
  const pathname = usePathname();

  function openManageTab() {
    window.history.pushState(null, "", `${pathname}?tab=manage`);
    window.dispatchEvent(
      new CustomEvent("dashboardTabChange", { detail: { tab: "manage" } }),
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openManageTab}
        className={`${btnDashboardActionClassName} gap-2`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
        </svg>
        Add Student
      </button>
      <RosterUploaderModal buttonClassName={btnDashboardActionClassName} />
      <Link
        href="/analyze"
        className={`${btnUploadCsvClassName} gap-2 no-underline`}
      >
        <NewAnalysisIcon />
        New Analysis
      </Link>
    </>
  );
}
