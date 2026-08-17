import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createTeacherAccount,
  findTeacherByEmailHash,
  touchTeacherLastActive,
} from "@/lib/db/queries";
import { hashEmail } from "@/lib/audit/log";
import type { TeacherAccount } from "@/lib/types";

export async function requireTeacher(): Promise<
  TeacherAccount | NextResponse
> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  if (!email) {
    return NextResponse.json(
      { error: "No email address on account" },
      { status: 401 },
    );
  }

  const emailHash = hashEmail(email);
  let teacher = await findTeacherByEmailHash(emailHash);

  if (!teacher) {
    teacher = await createTeacherAccount(emailHash);
  }

  await touchTeacherLastActive(teacher.id);
  return teacher;
}

export function isTeacherResponse(
  value: TeacherAccount | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireAdmin(): Promise<TeacherAccount | NextResponse> {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  if (teacher.role !== "eld_coordinator" && teacher.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return teacher;
}

export function isAdminRole(role: TeacherAccount["role"]): boolean {
  return role === "eld_coordinator" || role === "admin";
}
