interface LoadingArtifactProps {
  message?: string;
}

export function LoadingArtifact({
  message = "Analyzing artifact…",
}: LoadingArtifactProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-white p-12"
      role="status"
      aria-live="polite"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}
