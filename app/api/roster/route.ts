import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { isTeacherResponse, requireTeacher } from "@/lib/auth/teacher";
import { recordAudit } from "@/lib/audit/log";
import { createRosterEntries } from "@/lib/db/queries";
import { GradeSpanSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CsvRow {
  label: string;
  grade_span: string;
  known_elpac_level?: string;
  subject?: string;
}

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if (isTeacherResponse(teacher)) return teacher;

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

    const mappingRows: { label: string; student_uuid: string }[] = [];

    const rosterInputs = records.map((row) => {
      if (!row.label || !row.grade_span) {
        throw new Error("Each row must include label and grade_span");
      }

      const gradeSpan = GradeSpanSchema.parse(row.grade_span);
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
        known_elpac_level: knownLevel,
      };
    });

    const created = await createRosterEntries(
      teacher.id,
      rosterInputs.map(({ label, subject, grade_span, known_elpac_level }) => ({
        label,
        subject,
        grade_span,
        known_elpac_level,
      })),
    );

    created.forEach((entry, index) => {
      mappingRows.push({
        label: rosterInputs[index].label,
        student_uuid: entry.student_uuid,
      });
    });

    await recordAudit({
      actorId: teacher.id,
      action: "roster.upload",
      resourceType: "roster",
      resourceId: null,
      req,
    });

    return NextResponse.json({
      count: mappingRows.length,
      entries: mappingRows,
    });
  } catch (error) {
    console.error("[api/roster]", error);
    return NextResponse.json(
      { error: "Failed to process roster upload" },
      { status: 400 },
    );
  }
}
