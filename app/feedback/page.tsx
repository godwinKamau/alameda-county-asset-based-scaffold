import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DbWakingBanner } from "@/components/DbWakingBanner";
import { FeedbackForm } from "@/components/FeedbackForm";
import { hashEmail } from "@/lib/audit/log";
import { isDatabaseWakingError } from "@/lib/db/errors";
import { listGrantsForTeacher } from "@/lib/db/grade-grants";
import { findTeacherByEmailHash } from "@/lib/db/queries";
import {
  formatGradeAccessLabel,
  gradesSnapshotFromGrants,
} from "@/lib/feedback/grades";

function clerkDisplayName(user: {
  fullName: string | null;
  firstName: string | null;
  emailAddresses: { emailAddress: string }[];
}): string {
  const fullName = user.fullName?.trim();
  if (fullName) return fullName;

  const firstName = user.firstName?.trim();
  if (firstName) return firstName;

  const email = user.emailAddresses[0]?.emailAddress?.trim();
  if (email) return email.split("@")[0] ?? email;

  return "Teacher";
}

export default async function FeedbackPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  const teacherName = user ? clerkDisplayName(user) : "Teacher";

  let gradeAccessLabel = "No grade access yet";

  try {
    const teacher = await findTeacherByEmailHash(hashEmail(email));
    if (teacher) {
      const grants = await listGrantsForTeacher(teacher.id);
      gradeAccessLabel = formatGradeAccessLabel(
        gradesSnapshotFromGrants(grants),
      );
    }
  } catch (error) {
    if (isDatabaseWakingError(error)) {
      return (
        <DashboardShell title="Feedback">
          <DbWakingBanner />
        </DashboardShell>
      );
    }
    throw error;
  }

  return (
    <DashboardShell title="Feedback">
      <div className="mx-auto max-w-2xl">
        <FeedbackForm
          teacherName={teacherName}
          gradeAccessLabel={gradeAccessLabel}
        />
      </div>
    </DashboardShell>
  );
}
