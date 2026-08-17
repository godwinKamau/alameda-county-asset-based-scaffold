"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  btnDashboardActionClassName,
  btnUploadCsvClassName,
  cardClassName,
  fileInputClassName,
  mutedTextClassName,
  sectionTitleClassName,
} from "@/lib/ui/styles";
import { apiFetch, isDatabaseWakingError } from "@/lib/ui/api-fetch";
import { ErrorBanner } from "./ErrorBanner";

export function RosterUploaderModal({
  buttonClassName = btnUploadCsvClassName,
  apiBase = "/api/roster",
  onSuccess,
}: {
  buttonClassName?: string;
  apiBase?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function closeModal() {
    setOpen(false);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Please select a CSV file.");
      return;
    }

    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await apiFetch(apiBase, {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }

      const payload = (await response.json()) as {
        count: number;
      };

      setSuccess(
        `Uploaded ${payload.count} student${payload.count === 1 ? "" : "s"}.`,
      );

      form.reset();
      onSuccess?.() ?? router.refresh();
    } catch (uploadError) {
      if (isDatabaseWakingError(uploadError)) return;
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload roster",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        Upload Roster
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="presentation"
          >
            <button
              type="button"
              aria-label="Close upload roster dialog"
              className="absolute inset-0 bg-black/50"
              onClick={closeModal}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="upload-roster-title"
              className={`relative z-10 w-full max-w-lg ${cardClassName}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="upload-roster-title" className={sectionTitleClassName}>
                    Upload Roster
                  </h2>
                  <p className={`mt-1 ${mutedTextClassName}`}>
                    CSV columns:{" "}
                    <code className="text-xs">
                      label, grade_span, exact_grade (optional), known_elpac_level,
                      subject (optional)
                    </code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close"
                  className="rounded-lg px-2 py-1 text-xl leading-none text-brand-dark transition-colors hover:bg-slate-100"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <input
                  type="file"
                  name="file"
                  accept=".csv,text/csv"
                  className={fileInputClassName}
                />
                <button
                  type="submit"
                  disabled={uploading}
                  className={btnDashboardActionClassName}
                >
                  {uploading ? "Uploading…" : "Upload CSV"}
                </button>
              </form>

              {error && (
                <div className="mt-4">
                  <ErrorBanner message={error} />
                </div>
              )}
              {success && (
                <p className="mt-4 text-sm text-accent-green">{success}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
