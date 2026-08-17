"use client";

import { getStudentDisplayName } from "@/lib/roster/display";

interface StudentNameHeadingProps {
  label: string | null;
  studentUuid: string;
  className?: string;
}

export function StudentNameHeading({
  label,
  studentUuid,
  className = "text-2xl font-semibold text-brand-dark",
}: StudentNameHeadingProps) {
  const displayName =
    label?.trim() ||
    getStudentDisplayName({ label: "", student_uuid: studentUuid });

  return <h2 className={className}>{displayName}</h2>;
}
