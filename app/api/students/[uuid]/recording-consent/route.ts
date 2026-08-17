import { NextResponse } from "next/server";
import { withDbGuard } from "@/lib/api/with-db-guard";
import {
  isStudentAccessResponse,
  requireStudentAccess,
} from "@/lib/auth/student-access";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  getRecordingConsentStatus,
  insertRecordingConsent,
  isDistrictAudioRecordingEnabled,
  revokeRecordingConsent,
  type RecordingConsentSource,
} from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

const VALID_SOURCES = new Set<RecordingConsentSource>([
  "district_agreement",
  "signed_form_on_file",
  "other",
]);

async function buildConsentResponse(
  teacherId: string,
  studentUuid: string,
) {
  const [districtEnabled, consent] = await Promise.all([
    isDistrictAudioRecordingEnabled(teacherId),
    getRecordingConsentStatus(studentUuid),
  ]);

  return {
    districtEnabled,
    consented: consent.consented,
    status: consent.status,
    source: consent.source,
    recordedAt: consent.recordedAt,
  };
}

async function getHandler(req: Request, context: RouteContext) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const { uuid } = await context.params;
  const access = await requireStudentAccess(teacher, uuid);
  if (isStudentAccessResponse(access)) return access;

  return NextResponse.json(await buildConsentResponse(teacher.id, uuid));
}

async function postHandler(req: Request, context: RouteContext) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const { uuid } = await context.params;
  const access = await requireStudentAccess(teacher, uuid);
  if (isStudentAccessResponse(access)) return access;

  const districtEnabled = await isDistrictAudioRecordingEnabled(teacher.id);
  if (!districtEnabled) {
    return NextResponse.json(
      { error: "Audio recording is not enabled for your district." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const status =
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    (body.status === "granted" || body.status === "denied")
      ? body.status
      : null;
  const source =
    typeof body === "object" &&
    body !== null &&
    "source" in body &&
    typeof body.source === "string" &&
    VALID_SOURCES.has(body.source as RecordingConsentSource)
      ? (body.source as RecordingConsentSource)
      : null;
  const note =
    typeof body === "object" &&
    body !== null &&
    "note" in body &&
    typeof body.note === "string"
      ? body.note
      : undefined;

  if (!status || !source) {
    return NextResponse.json(
      { error: "status and source are required." },
      { status: 400 },
    );
  }

  await insertRecordingConsent({
    studentUuid: uuid,
    teacherId: teacher.id,
    status,
    source,
    note,
  });

  await recordAudit({
    actorId: teacher.id,
    action: "consent.record",
    resourceType: "student",
    resourceId: uuid,
    req,
    authorizedBy: access.grantId,
    authorizedByType: "grade_grant",
  });

  return NextResponse.json(await buildConsentResponse(teacher.id, uuid));
}

async function deleteHandler(req: Request, context: RouteContext) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

  const { uuid } = await context.params;
  const access = await requireStudentAccess(teacher, uuid);
  if (isStudentAccessResponse(access)) return access;

  await revokeRecordingConsent(uuid);

  await recordAudit({
    actorId: teacher.id,
    action: "consent.revoke",
    resourceType: "student",
    resourceId: uuid,
    req,
    authorizedBy: access.grantId,
    authorizedByType: "grade_grant",
  });

  return NextResponse.json(await buildConsentResponse(teacher.id, uuid));
}

export const GET = withDbGuard(getHandler);
export const POST = withDbGuard(postHandler);
export const DELETE = withDbGuard(deleteHandler);
