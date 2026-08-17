import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { DomainSchema } from "@/lib/elpac/domain";
import { getPldsForDomainAndSpan } from "@/lib/elpac/loader";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { GradeSpanSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const url = new URL(req.url);
  const domain = DomainSchema.parse(url.searchParams.get("domain") ?? "listening");
  const gradeSpan = GradeSpanSchema.parse(
    url.searchParams.get("grade_span") ?? "3-12",
  );

  const plds = getPldsForDomainAndSpan(domain, gradeSpan);
  return NextResponse.json({ plds });
}

export const GET = withDbGuard(getHandler);
