import { DashboardShell } from "@/components/DashboardShell";
import { cardClassName, mutedTextClassName, sectionTitleClassName } from "@/lib/ui/styles";

export default function ProgressPage() {
  return (
    <DashboardShell title="Progress">
      <div className="mx-auto max-w-3xl">
        <div className={cardClassName}>
          <h2 className={sectionTitleClassName}>Coming soon</h2>
          <p className={`mt-2 ${mutedTextClassName}`}>
            Class-wide progress tracking and growth trends will appear here in a
            future update.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
