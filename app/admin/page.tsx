import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardShell } from "@/components/DashboardShell";
import { DbWakingBanner } from "@/components/DbWakingBanner";
import { recordAudit, hashEmail } from "@/lib/audit/log";
import { isDatabaseWakingError } from "@/lib/db/errors";
import {
  findTeacherByEmailHash,
  listSchoolAccessForTeacher,
} from "@/lib/db/queries";
import { cardClassName, sectionTitleClassName } from "@/lib/ui/styles";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  let teacher: Awaited<ReturnType<typeof findTeacherByEmailHash>>;
  let accessRows: Awaited<ReturnType<typeof listSchoolAccessForTeacher>> = [];

  try {
    teacher = await findTeacherByEmailHash(hashEmail(email));
    const isAdmin =
      teacher?.role === "eld_coordinator" || teacher?.role === "admin";
    if (teacher && isAdmin) {
      accessRows = await listSchoolAccessForTeacher(teacher.id);
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
        <DashboardShell title="Admin — School Access">
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
    <DashboardShell title="Admin — School Access">
      <div className="mx-auto max-w-5xl">
        <section className={cardClassName}>
          <h2 className={sectionTitleClassName}>Your School Access</h2>
          {accessRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No school access records assigned yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-brand-soft/80">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-soft bg-brand-soft/40 text-muted">
                    <th className="px-4 py-3 font-medium">School</th>
                    <th className="px-4 py-3 font-medium">Access</th>
                    <th className="px-4 py-3 font-medium">Granted</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-brand-soft/60 text-brand-dark last:border-0"
                    >
                      <td className="px-4 py-3">{row.school_name}</td>
                      <td className="px-4 py-3 capitalize">{row.access_level}</td>
                      <td className="px-4 py-3">
                        {new Date(row.granted_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
