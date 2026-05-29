"use client";

import { useEffect, useState } from "react";
import { getLabelMapping, resolveDisplayName } from "@/lib/roster/group";

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
  const [displayName, setDisplayName] = useState<string>(() => {
    const trimmed = label?.trim();
    if (trimmed) return trimmed;
    return `${studentUuid.slice(0, 8)}…`;
  });

  useEffect(() => {
    const mapping = getLabelMapping();
    const resolved = resolveDisplayName(
      { label: label ?? "", student_uuid: studentUuid },
      mapping,
    );
    setDisplayName(resolved);
  }, [label, studentUuid]);

  return <h2 className={className}>{displayName}</h2>;
}
