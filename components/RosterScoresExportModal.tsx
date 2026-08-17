"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildRosterScoreExportRows,
  buildRosterScoresCsv,
  rosterScoresExportFilename,
  ROSTER_SCORE_EXPORT_COLUMNS,
  type RosterScoreExportEntry,
  type TeacherGroupForExport,
} from "@/lib/roster/export";
import { apiFetch, isDatabaseWakingError } from "@/lib/ui/api-fetch";
import {
  btnDashboardActionClassName,
  btnUploadCsvClassName,
  cardClassName,
  mutedTextClassName,
  sectionTitleClassName,
} from "@/lib/ui/styles";
import { ErrorBanner } from "./ErrorBanner";

interface RosterScoresExportModalProps {
  entries: RosterScoreExportEntry[];
  groups: TeacherGroupForExport[];
  buttonClassName?: string;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RosterScoresExportModal({
  entries,
  groups,
  buttonClassName = btnUploadCsvClassName,
}: RosterScoresExportModalProps) {
  const [open, setOpen] = useState(false);
  const [scrubNames, setScrubNames] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportOptions = useMemo(
    () => ({ scrubNames, groups }),
    [scrubNames, groups],
  );

  const csvPreview = useMemo(
    () => buildRosterScoresCsv(entries, exportOptions),
    [entries, exportOptions],
  );

  const previewRows = useMemo(
    () => buildRosterScoreExportRows(entries, exportOptions),
    [entries, exportOptions],
  );

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
    setScrubNames(true);
  }

  async function handleDownload() {
    setError(null);
    setDownloading(true);

    try {
      const response = await apiFetch("/api/students/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrub_names: scrubNames,
          row_count: entries.length,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }

      downloadCsv(csvPreview, rosterScoresExportFilename());
      closeModal();
    } catch (downloadError) {
      if (isDatabaseWakingError(downloadError)) return;
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to export roster scores",
      );
    } finally {
      setDownloading(false);
    }
  }

  const disabled = entries.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
        disabled={disabled}
        aria-disabled={disabled}
      >
        Export CSV
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="presentation"
          >
            <button
              type="button"
              aria-label="Close export roster dialog"
              className="absolute inset-0 bg-black/50"
              onClick={closeModal}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-roster-title"
              className={`relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col ${cardClassName}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="export-roster-title" className={sectionTitleClassName}>
                    Export roster scores
                  </h2>
                  <p className={`mt-1 ${mutedTextClassName}`}>
                    {entries.length}{" "}
                    {entries.length === 1 ? "student" : "students"} in this
                    export. Preview matches the downloaded file.
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

              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-brand-dark">
                <input
                  type="checkbox"
                  checked={scrubNames}
                  onChange={(event) => setScrubNames(event.target.checked)}
                  className="h-4 w-4 rounded border-brand-soft text-brand focus:ring-brand"
                />
                Scrub student names (replace with Student A, Student B, …)
              </label>

              <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-brand-soft/80">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-brand-soft bg-brand-soft/40 text-muted">
                      {ROSTER_SCORE_EXPORT_COLUMNS.map((column) => (
                        <th
                          key={column.key}
                          className="px-4 py-3 font-medium whitespace-nowrap"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={ROSTER_SCORE_EXPORT_COLUMNS.length}
                          className="px-4 py-6 text-center text-muted"
                        >
                          No students to export.
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row, index) => (
                        <tr
                          key={`${row.name}-${index}`}
                          className="border-b border-brand-soft/60 text-brand-dark last:border-0"
                        >
                          {ROSTER_SCORE_EXPORT_COLUMNS.map((column) => {
                            const value = row[column.key];
                            const isScore =
                              column.key === "avg_level" ||
                              column.key === "latest_analysis_level" ||
                              column.key === "listening" ||
                              column.key === "speaking" ||
                              column.key === "reading" ||
                              column.key === "writing";
                            const isCount = column.key === "total_analyses";

                            return (
                              <td
                                key={column.key}
                                className="px-4 py-3 align-top whitespace-nowrap"
                              >
                                {value ? (
                                  isScore || isCount ? (
                                    <span className="font-semibold tabular-nums">
                                      {value}
                                    </span>
                                  ) : (
                                    value
                                  )
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                  className={btnDashboardActionClassName}
                >
                  {downloading ? "Preparing…" : "Download CSV"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-sm text-muted hover:text-brand-dark"
                >
                  Cancel
                </button>
              </div>

              {error && (
                <div className="mt-4">
                  <ErrorBanner message={error} />
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
