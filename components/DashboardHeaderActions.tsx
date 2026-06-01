"use client";

import Link from "next/link";
import { NewAnalysisIcon } from "@/components/NewAnalysisIcon";
import { RosterUploaderModal } from "@/components/RosterUploaderModal";
import {
  btnDashboardActionClassName,
  btnUploadCsvClassName,
} from "@/lib/ui/styles";

export function DashboardHeaderActions() {
  return (
    <>
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
