import type { ReactNode } from "react";

type AccentColor = "brand" | "orange" | "green";

const accentBar: Record<AccentColor, string> = {
  brand: "bg-brand",
  orange: "bg-accent-orange",
  green: "bg-accent-green",
};

const iconBg: Record<AccentColor, string> = {
  brand: "bg-brand-soft text-brand",
  orange: "bg-orange-50 text-accent-orange",
  green: "bg-emerald-50 text-accent-green",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: AccentColor;
}

export function StatCard({
  label,
  value,
  icon,
  accent = "brand",
}: StatCardProps) {
  return (
    <div className="ui-card relative overflow-hidden p-5">
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 ${accentBar[accent]}`}
        aria-hidden="true"
      />
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBg[accent]}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand-dark">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
