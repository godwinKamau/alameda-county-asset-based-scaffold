import type { GradeSpan } from "@/lib/types";

export interface PendingAnalyzeContext {
  studentUuid: string;
  studentLabel: string;
  gradeSpan: GradeSpan;
  providedLevel: string | null;
  subject: string;
}

let pendingFormData: FormData | null = null;
let pendingContext: PendingAnalyzeContext | null = null;

export function setPendingAnalyzeRequest(
  formData: FormData,
  context: PendingAnalyzeContext,
): void {
  pendingFormData = formData;
  pendingContext = context;
}

export function getPendingAnalyzeRequest(): {
  formData: FormData;
  context: PendingAnalyzeContext;
} | null {
  if (!pendingFormData || !pendingContext) {
    return null;
  }

  return {
    formData: pendingFormData,
    context: pendingContext,
  };
}

export function clearPendingAnalyzeRequest(): void {
  pendingFormData = null;
  pendingContext = null;
}
