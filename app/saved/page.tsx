import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DbWakingBanner } from "@/components/DbWakingBanner";
import { SavedInsightCard } from "@/components/SavedInsightCard";
import { hashEmail } from "@/lib/audit/log";
import { isDatabaseWakingError } from "@/lib/db/errors";
import {
  findTeacherByEmailHash,
  listSavedInsights,
} from "@/lib/db/queries";
import {
  cardClassName,
  mutedTextClassName,
  sectionTitleClassName,
} from "@/lib/ui/styles";

export default async function SavedInsightsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  let teacher: Awaited<ReturnType<typeof findTeacherByEmailHash>>;
  let savedInsights: Awaited<ReturnType<typeof listSavedInsights>> = [];

  try {
    teacher = await findTeacherByEmailHash(hashEmail(email));
    if (teacher) {
      savedInsights = await listSavedInsights(teacher.id);
    }
  } catch (err) {
    if (isDatabaseWakingError(err)) {
      return (
        <DashboardShell title="Saved Insights">
          <DbWakingBanner />
        </DashboardShell>
      );
    }
    throw err;
  }

  if (!teacher) redirect("/dashboard");

  return (
    <DashboardShell title="Saved Insights">
      <div className="mx-auto max-w-3xl space-y-4">
        {savedInsights.length === 0 ? (
          <div className={cardClassName}>
            <h2 className={sectionTitleClassName}>No saved insights yet</h2>
            <p className={`mt-2 ${mutedTextClassName}`}>
              Star individual scaffold items on an analysis results page to save
              them here for quick reference.
            </p>
          </div>
        ) : (
          savedInsights.map((insight) => (
            <SavedInsightCard key={insight.id} insight={insight} />
          ))
        )}
      </div>
    </DashboardShell>
  );
}
