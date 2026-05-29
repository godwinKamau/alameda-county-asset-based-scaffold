interface LoadingArtifactProps {
  message?: string;
}

export function LoadingArtifact({
  message = "Analyzing artifact…",
}: LoadingArtifactProps) {
  return (
    <div
      className="ui-card flex flex-col items-center justify-center gap-4 p-12"
      role="status"
      aria-live="polite"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
      <p className="text-sm font-medium text-muted">{message}</p>
    </div>
  );
}
