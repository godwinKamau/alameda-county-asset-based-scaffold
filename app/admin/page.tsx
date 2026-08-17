import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardShell } from "@/components/DashboardShell";
import { DbWakingBanner } from "@/components/DbWakingBanner";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { recordAudit, hashEmail } from "@/lib/audit/log";
import { isDatabaseWakingError } from "@/lib/db/errors";
import {
  countStudentsMissingGrade,
  findTeacherByEmailHash,
} from "@/lib/db/queries";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  let teacher: Awaited<ReturnType<typeof findTeacherByEmailHash>>;
  let missingGradeCount = 0;

  try {
    teacher = await findTeacherByEmailHash(hashEmail(email));
    const isAdmin =
      teacher?.role === "eld_coordinator" || teacher?.role === "admin";
    if (teacher && isAdmin) {
      missingGradeCount = await countStudentsMissingGrade(teacher.school_id);
      const headerList = await headers();
      await recordAudit({
        actorId: teacher.id,
        action: "admin.view",
        resourceType: "admin",
        resourceId: teacher.id,
        req: new Request("http://localhost", { headers: headerList }),
      });
    }
  } catch (err) {
    if (isDatabaseWakingError(err)) {
      return (
        <DashboardShell title="Admin">
          <DbWakingBanner />
        </DashboardShell>
      );
    }
    throw err;
  }

  if (!teacher) redirect("/dashboard");
  if (teacher.role !== "eld_coordinator" && teacher.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <DashboardShell title="Admin">
      <div className="mx-auto max-w-5xl">
        <AdminPanel
          missingGradeCount={missingGradeCount}
          schoolId={teacher.school_id}
          currentTeacherId={teacher.id}
        />
      </div>
    </DashboardShell>
  );
}
