"use client";

import Link from "next/link";
import { NewAnalysisIcon } from "@/components/NewAnalysisIcon";
import { btnUploadCsvClassName } from "@/lib/ui/styles";

export function DashboardHeaderActions() {
  return (
    <Link
      href="/analyze"
      className={`${btnUploadCsvClassName} gap-2 no-underline`}
    >
      <NewAnalysisIcon />
      New Analysis
    </Link>
  );
}
