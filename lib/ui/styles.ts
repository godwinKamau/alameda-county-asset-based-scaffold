/** Shared Tailwind class strings for the teacher dashboard design system */

export const cardClassName = "ui-card p-6";

export const inputClassName =
  "ui-input";

export const selectClassName = inputClassName;

export const labelClassName = "block text-sm font-medium text-brand-dark";

export const btnPrimaryClassName = "ui-btn-primary";

export const btnDashboardActionClassName = "ui-btn-dashboard-action";

export const btnSecondaryClassName = "ui-btn-secondary";

export const btnUploadCsvClassName = "ui-btn-upload-csv";

/** Compact row actions (History / Analyze) — shared height, radius, and padding */
export const btnRowActionClassName = "h-8 rounded-2xl px-3 py-0 text-xs";

export const fileInputClassName = "ui-file-input";

export const linkClassName = "ui-link text-sm font-medium";

export const pageTitleClassName = "text-2xl font-semibold text-brand-dark";

export const sectionTitleClassName = "text-lg font-semibold text-brand-dark";

export const mutedTextClassName = "text-sm text-muted";

export const helperTextClassName = "mt-1 text-xs text-muted";

export const requiredDotClassName =
  "ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-orange align-middle";

export const tabListClassName =
  "inline-flex rounded-2xl bg-brand-dark/10 p-1 shadow-[inset_0_2px_6px_rgba(0,18,51,0.12)] ring-1 ring-brand-dark/10";

export const tabButtonActiveClassName =
  "rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-dark shadow-[0_1px_3px_rgba(0,18,51,0.14),0_1px_2px_rgba(0,18,51,0.06)] transition-all";

export const tabButtonInactiveClassName =
  "rounded-xl px-4 py-2 text-sm font-medium text-brand-dark/55 transition-all hover:text-brand-dark/85";

export const badgeNeverAnalyzedClassName =
  "inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-accent-orange";

export const badgeLevelClassName = (level: number) => {
  const colors: Record<number, string> = {
    1: "bg-orange-50 text-accent-orange",
    2: "bg-amber-50 text-amber-700",
    3: "bg-blue-50 text-brand",
    4: "bg-emerald-50 text-accent-green",
  };
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[level] ?? "bg-slate-100 text-muted"}`;
};
