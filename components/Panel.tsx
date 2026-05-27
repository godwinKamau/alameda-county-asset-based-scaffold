"use client";

type PanelVariant = "strengths" | "level" | "gap" | "scaffold";

const variantStyles: Record<PanelVariant, string> = {
  strengths: "border-l-4 border-emerald-500",
  level: "border-l-4 border-slate-300",
  gap: "border-l-4 border-amber-500",
  scaffold: "border-l-4 border-blue-500",
};

interface PanelProps {
  title: string;
  variant: PanelVariant;
  children: React.ReactNode;
  className?: string;
  showTitle?: boolean;
}

export function Panel({
  title,
  variant,
  children,
  className,
  showTitle = true,
}: PanelProps) {
  return (
    <section
      className={`rounded-lg bg-white p-5 shadow-sm ${variantStyles[variant]} ${className ?? ""}`}
    >
      {showTitle && (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
      )}
      <div className="text-slate-800">{children}</div>
    </section>
  );
}
