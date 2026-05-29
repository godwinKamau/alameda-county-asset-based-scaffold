"use client";

type PanelVariant = "strengths" | "level" | "gap" | "scaffold";

const variantStyles: Record<PanelVariant, string> = {
  strengths: "border-l-4 border-accent-green",
  level: "border-l-4 border-brand",
  gap: "border-l-4 border-accent-orange",
  scaffold: "border-l-4 border-brand",
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
      className={`ui-card p-5 ${variantStyles[variant]} ${className ?? ""}`}
    >
      {showTitle && (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
        </h3>
      )}
      <div className="text-brand-dark">{children}</div>
    </section>
  );
}
