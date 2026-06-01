import Link from "next/link";
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
  sublabel?: string;
  highlight?: boolean;
  href?: string;
}

function StatCardContent({
  label,
  value,
  icon,
  accent = "brand",
  sublabel,
}: Omit<StatCardProps, "href" | "highlight">) {
  return (
    <>
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
          <p
            className={`mt-1 text-3xl font-bold tabular-nums ${
              accent === "orange" ? "text-accent-orange" : "text-brand-dark"
            }`}
          >
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 text-xs text-muted">{sublabel}</p>
          )}
        </div>
      </div>
    </>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "brand",
  sublabel,
  highlight = false,
  href,
}: StatCardProps) {
  const className = `ui-card relative h-full w-full overflow-hidden p-5${
    highlight ? " ring-2 ring-accent-orange/60" : ""
  }${href ? " transition-shadow hover:shadow-md" : ""}`;

  if (href) {
    return (
      <Link href={href} className={`${className} block`}>
        <StatCardContent
          label={label}
          value={value}
          icon={icon}
          accent={accent}
          sublabel={sublabel}
        />
      </Link>
    );
  }

  return (
    <div className={className}>
      <StatCardContent
        label={label}
        value={value}
        icon={icon}
        accent={accent}
        sublabel={sublabel}
      />
    </div>
  );
}
