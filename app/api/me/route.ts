import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler(_req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  return NextResponse.json({ role: teacher.role });
}

export const GET = withDbGuard(getHandler);
