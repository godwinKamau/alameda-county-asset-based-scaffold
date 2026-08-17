import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { hashEmail } from "@/lib/audit/log";

export interface NamedTeacher {
  id: string;
  role: string;
  name: string;
}

function clerkDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  emailAddresses: { emailAddress: string }[];
}): string {
  const fullName = [user.firstName, user.lastName]
    .filter((part) => part?.trim())
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (user.username?.trim()) return user.username.trim();

  const email = user.emailAddresses[0]?.emailAddress?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Unknown teacher";
}

async function namesByEmailHash(): Promise<Map<string, string>> {
  const client = await clerkClient();
  const names = new Map<string, string>();
  const pageSize = 100;
  let offset = 0;

  while (offset < 1000) {
    const page = await client.users.getUserList({
      limit: pageSize,
      offset,
    });

    for (const user of page.data) {
      const name = clerkDisplayName(user);
      for (const email of user.emailAddresses) {
        if (!email.emailAddress) continue;
        names.set(hashEmail(email.emailAddress), name);
      }
    }

    if (page.data.length < pageSize) break;
    offset += pageSize;
  }

  return names;
}

export function fallbackTeacherName(teacherId: string): string {
  return `Teacher ${teacherId.slice(0, 8)}`;
}

export async function attachTeacherNames(
  teachers: { id: string; role: string; email_hash: string }[],
): Promise<NamedTeacher[]> {
  let names = new Map<string, string>();
  try {
    names = await namesByEmailHash();
  } catch (error) {
    console.error("[teacher-names] Failed to resolve Clerk display names", error);
  }

  return teachers
    .map((teacher) => ({
      id: teacher.id,
      role: teacher.role,
      name: names.get(teacher.email_hash) ?? fallbackTeacherName(teacher.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
