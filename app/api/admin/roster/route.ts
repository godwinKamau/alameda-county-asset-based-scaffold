import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { withDbGuard } from "@/lib/api/with-db-guard";
import { isTeacherResponse, requireAdmin } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import {
  databaseWakingResponse,
  isDatabaseWakingError,
} from "@/lib/db/errors";
import { createRosterEntries } from "@/lib/db/queries";
import {
  deriveGradeSpan,
  ExactGradeSchema,
  GradeSpanSchema,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CsvRow {
  label: string;
  grade_span?: string;
  exact_grade?: string;
  known_elpac_level?: string;
  subject?: string;
}

function parseExactGrade(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

async function getHandler() {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  const { listSchoolRosterEntries } = await import("@/lib/db/queries");
  const entries = await listSchoolRosterEntries(admin.school_id);
  return NextResponse.json({ entries });
}

async function postHandler(req: Request) {
  const admin = await requireAdmin();
  if (isTeacherResponse(admin)) return admin;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];

    if (records.length === 0) {
      return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
    }

    const rosterInputs = records.map((row) => {
      if (!row.label) {
        throw new Error("Each row must include label");
      }

      const exactGradeRaw = parseExactGrade(row.exact_grade);
      const gradeSpanRaw = row.grade_span?.trim() ?? "";

      if (!exactGradeRaw && !gradeSpanRaw) {
        throw new Error(
          `Row "${row.label}": grade_span or exact_grade is required`,
        );
      }

      let exactGrade = null;
      if (exactGradeRaw) {
        const parsed = ExactGradeSchema.safeParse(exactGradeRaw);
        if (!parsed.success) {
          throw new Error(
            `Row "${row.label}": exact_grade must be one of K, 1-12`,
          );
        }
        exactGrade = parsed.data;
      }

      let gradeSpan;
      if (gradeSpanRaw) {
        gradeSpan = GradeSpanSchema.parse(gradeSpanRaw);
      } else {
        gradeSpan = deriveGradeSpan(exactGrade!);
      }

      if (exactGrade && gradeSpanRaw) {
        const derived = deriveGradeSpan(exactGrade);
        if (derived !== gradeSpan) {
          throw new Error(
            `Row "${row.label}": exact_grade '${exactGrade}' conflicts with grade_span '${gradeSpan}'`,
          );
        }
      }

      const knownLevel = row.known_elpac_level
        ? Number.parseInt(row.known_elpac_level, 10)
        : null;

      if (
        knownLevel != null &&
        (Number.isNaN(knownLevel) || knownLevel < 1 || knownLevel > 4)
      ) {
        throw new Error("known_elpac_level must be 1-4 when provided");
      }

      return {
        label: row.label,
        subject: row.subject?.trim() ?? "",
        grade_span: gradeSpan,
        exact_grade: exactGrade,
        known_elpac_level: knownLevel,
      };
    });

    const created = await createRosterEntries(
      admin.id,
      rosterInputs.map(
        ({ label, subject, grade_span, exact_grade, known_elpac_level }) => ({
          label,
          subject,
          grade_span,
          exact_grade,
          known_elpac_level,
        }),
      ),
      admin.school_id,
    );

    await recordAudit({
      actorId: admin.id,
      action: "roster.upload",
      resourceType: "roster",
      resourceId: null,
      req,
      authorizedByType: "admin_role",
    });

    return NextResponse.json({ count: created.length });
  } catch (error) {
    if (isDatabaseWakingError(error)) {
      return databaseWakingResponse();
    }
    console.error("[api/admin/roster]", error);
    const message =
      error instanceof Error ? error.message : "Failed to process roster upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const GET = withDbGuard(getHandler);
export const POST = withDbGuard(postHandler);
