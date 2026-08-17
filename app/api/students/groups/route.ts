import { NextResponse } from "next/server";
import { z } from "zod";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { createGroup, listGroupsWithMembers } from "@/lib/db/teacher-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

async function getHandler() {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const groups = await listGroupsWithMembers(teacher.id);
  return NextResponse.json({ groups });
}

async function postHandler(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  try {
    const body = CreateGroupSchema.parse(await req.json());
    const group = await createGroup(teacher.id, body.name);
    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}

export const GET = withDbGuard(getHandler);
export const POST = withDbGuard(postHandler);
