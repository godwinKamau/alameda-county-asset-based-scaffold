"use client";

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-error"
      role="alert"
    >
      {message}
    </div>
  );
}
