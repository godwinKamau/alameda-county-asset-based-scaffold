"use client";

import { useEffect, useState } from "react";
import {
  MAX_PAGES_PER_ANALYSIS,
  MAX_SOURCE_ARTIFACT_BYTES,
  formatMegabytes,
} from "@/lib/artifact/constants";
import {
  getPdfPageThumbnails,
  isPdfFile,
  type PdfPageThumbnail,
} from "@/lib/artifact/prepare-upload";
import { fileInputClassName, labelClassName } from "@/lib/ui/styles";

interface ArtifactDropzoneProps {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  selectedPages: number[];
  onSelectedPagesChange: (pages: number[]) => void;
  onPreviewLoadingChange?: (loading: boolean) => void;
}

export function ArtifactDropzone({
  onFileSelect,
  file,
  selectedPages,
  onSelectedPagesChange,
  onPreviewLoadingChange,
}: ArtifactDropzoneProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [thumbnails, setThumbnails] = useState<PdfPageThumbnail[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  useEffect(() => {
    onPreviewLoadingChange?.(loadingThumbnails);
  }, [loadingThumbnails, onPreviewLoadingChange]);

  useEffect(() => {
    if (!file || !isPdfFile(file)) {
      setTotalPages(0);
      setThumbnails([]);
      setThumbnailError(null);
      onSelectedPagesChange([]);
      return;
    }

    let cancelled = false;
    setLoadingThumbnails(true);
    setThumbnailError(null);

    getPdfPageThumbnails(file, MAX_PAGES_PER_ANALYSIS)
      .then(({ totalPages: count, thumbnails: nextThumbnails }) => {
        if (cancelled) return;

        setTotalPages(count);
        setThumbnails(nextThumbnails);
        onSelectedPagesChange([1]);
      })
      .catch((error) => {
        if (cancelled) return;
        setTotalPages(0);
        setThumbnails([]);
        setThumbnailError(
          error instanceof Error ? error.message : "Could not read PDF pages.",
        );
        onSelectedPagesChange([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingThumbnails(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file, onSelectedPagesChange]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    onFileSelect(event.target.files?.[0] ?? null);
  }

  function togglePage(pageNumber: number) {
    if (selectedPages.includes(pageNumber)) {
      if (selectedPages.length === 1) return;
      onSelectedPagesChange(
        selectedPages.filter((page) => page !== pageNumber).sort((a, b) => a - b),
      );
      return;
    }

    if (selectedPages.length >= MAX_PAGES_PER_ANALYSIS) {
      return;
    }

    onSelectedPagesChange(
      [...selectedPages, pageNumber].sort((a, b) => a - b),
    );
  }

  const showPagePicker = file && isPdfFile(file) && totalPages > 1;

  return (
    <div>
      <label htmlFor="artifact" className={labelClassName}>
        Writing Artifact
      </label>
      <input
        id="artifact"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf,.heic,.heif"
        onChange={handleFileChange}
        className={fileInputClassName}
      />
      <p className="mt-1 text-xs text-muted">
        JPG, PNG, GIF, WEBP, HEIC, or PDF — up to{" "}
        {formatMegabytes(MAX_SOURCE_ARTIFACT_BYTES)}. Files are optimized
        automatically before upload.
      </p>
      {file && (
        <p className="mt-2 text-xs text-muted">
          Selected: {file.name} ({Math.round(file.size / 1024)} KB)
        </p>
      )}

      {showPagePicker && (
        <div className="mt-4 rounded-2xl border border-brand-soft bg-brand-soft/40 p-4">
          <p className="text-sm font-medium text-brand-dark">
            Select page(s) with student writing
          </p>
          <p className="mt-1 text-xs text-muted">
            Check every page that contains handwriting. When multiple pages are
            selected, analysis will focus on writing and ignore cover images or
            prompts.
          </p>
          {totalPages > MAX_PAGES_PER_ANALYSIS && (
            <p className="mt-2 text-xs text-accent-orange">
              Showing first {MAX_PAGES_PER_ANALYSIS} of {totalPages} pages.
            </p>
          )}
          {loadingThumbnails ? (
            <div
              className="mt-3 flex items-center gap-2 text-xs text-muted"
              role="status"
              aria-live="polite"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-soft border-t-brand" />
              Loading page previews…
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {thumbnails.map((thumbnail) => {
                const checked = selectedPages.includes(thumbnail.pageNumber);
                return (
                  <label
                    key={thumbnail.pageNumber}
                    className={`cursor-pointer rounded-xl border p-2 ${
                      checked
                        ? "border-brand bg-white ring-1 ring-brand"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => togglePage(thumbnail.pageNumber)}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnail.dataUrl}
                      alt={`PDF page ${thumbnail.pageNumber}`}
                      className="h-28 w-full rounded object-contain"
                    />
                    <p className="mt-2 text-center text-xs font-medium text-brand-dark">
                      Page {thumbnail.pageNumber}
                    </p>
                  </label>
                );
              })}
            </div>
          )}
          {selectedPages.length > 0 && !loadingThumbnails && (
            <p className="mt-3 text-xs text-muted">
              Selected: {selectedPages.join(", ")}
            </p>
          )}
        </div>
      )}

      {thumbnailError && (
        <p className="mt-2 text-xs text-error">{thumbnailError}</p>
      )}
    </div>
  );
}
