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

interface ArtifactDropzoneProps {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  selectedPages: number[];
  onSelectedPagesChange: (pages: number[]) => void;
}

export function ArtifactDropzone({
  onFileSelect,
  file,
  selectedPages,
  onSelectedPagesChange,
}: ArtifactDropzoneProps) {
  const [totalPages, setTotalPages] = useState(0);
  const [thumbnails, setThumbnails] = useState<PdfPageThumbnail[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

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
      <label htmlFor="artifact" className="block text-sm font-medium text-slate-700">
        Writing Artifact
      </label>
      <input
        id="artifact"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf,.heic,.heif"
        onChange={handleFileChange}
        className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
      />
      <p className="mt-1 text-xs text-slate-500">
        JPG, PNG, GIF, WEBP, HEIC, or PDF — up to{" "}
        {formatMegabytes(MAX_SOURCE_ARTIFACT_BYTES)}. Files are optimized
        automatically before upload.
      </p>
      {file && (
        <p className="mt-2 text-xs text-slate-500">
          Selected: {file.name} ({Math.round(file.size / 1024)} KB)
        </p>
      )}

      {showPagePicker && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">
            Select page(s) with student writing
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Check every page that contains handwriting. When multiple pages are
            selected, analysis will focus on writing and ignore cover images or
            prompts.
          </p>
          {totalPages > MAX_PAGES_PER_ANALYSIS && (
            <p className="mt-2 text-xs text-amber-700">
              Showing first {MAX_PAGES_PER_ANALYSIS} of {totalPages} pages.
            </p>
          )}
          {loadingThumbnails ? (
            <p className="mt-3 text-xs text-slate-500">Loading page previews…</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {thumbnails.map((thumbnail) => {
                const checked = selectedPages.includes(thumbnail.pageNumber);
                return (
                  <label
                    key={thumbnail.pageNumber}
                    className={`cursor-pointer rounded-md border p-2 ${
                      checked
                        ? "border-blue-500 bg-white ring-1 ring-blue-500"
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
                    <p className="mt-2 text-center text-xs font-medium text-slate-700">
                      Page {thumbnail.pageNumber}
                    </p>
                  </label>
                );
              })}
            </div>
          )}
          {selectedPages.length > 0 && !loadingThumbnails && (
            <p className="mt-3 text-xs text-slate-600">
              Selected: {selectedPages.join(", ")}
            </p>
          )}
        </div>
      )}

      {thumbnailError && (
        <p className="mt-2 text-xs text-red-600">{thumbnailError}</p>
      )}
    </div>
  );
}
