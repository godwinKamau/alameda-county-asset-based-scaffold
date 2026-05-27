"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner } from "./ErrorBanner";

export function RosterUploader() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

      const response = await fetch("/api/roster", {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }

      const payload = (await response.json()) as {
        count: number;
        entries: { label: string; student_uuid: string }[];
      };

      const mapping: Record<string, string> = {};
      for (const entry of payload.entries ?? []) {
        if (entry.label && entry.student_uuid) {
          mapping[entry.student_uuid] = entry.label;
        }
      }

      localStorage.setItem("student_label_mapping", JSON.stringify(mapping));
      setSuccess(
        `Uploaded ${payload.count} student${payload.count === 1 ? "" : "s"} to your roster.`,
      );

      form.reset();
      router.refresh();
    } catch (uploadError) {
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
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Upload Roster</h2>
      <p className="mt-1 text-sm text-slate-600">
        CSV columns:{" "}
        <code className="text-xs">
          label, grade_span, known_elpac_level, subject (optional)
        </code>
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="submit"
          disabled={uploading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload CSV"}
        </button>
      </form>

      {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
      {success && (
        <p className="mt-4 text-sm text-emerald-700">{success}</p>
      )}
    </div>
  );
}
