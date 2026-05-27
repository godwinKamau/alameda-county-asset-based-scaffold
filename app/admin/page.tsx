import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppHeader } from "@/components/AppHeader";
import { recordAudit } from "@/lib/audit/log";
import { hashEmail } from "@/lib/audit/log";
import {
  findTeacherByEmailHash,
  listSchoolAccessForTeacher,
} from "@/lib/db/queries";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  if (!email) redirect("/login");

  const teacher = await findTeacherByEmailHash(hashEmail(email));
  if (!teacher) redirect("/dashboard");

  if (teacher.role !== "eld_coordinator" && teacher.role !== "admin") {
    redirect("/dashboard");
  }

  const accessRows = await listSchoolAccessForTeacher(teacher.id);

  const headerList = await headers();
  await recordAudit({
    actorId: teacher.id,
    action: "admin.view",
    resourceType: "admin",
    resourceId: teacher.id,
    req: new Request("http://localhost", { headers: headerList }),
  });

  return (
    <>
      <AppHeader title="Admin — School Access" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Your School Access
          </h2>
          {accessRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No school access records assigned yet.
            </p>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">School</th>
                  <th className="py-2 pr-4 font-medium">Access</th>
                  <th className="py-2 font-medium">Granted</th>
                </tr>
              </thead>
              <tbody>
                {accessRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4">{row.school_name}</td>
                    <td className="py-3 pr-4 capitalize">{row.access_level}</td>
                    <td className="py-3">
                      {new Date(row.granted_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
