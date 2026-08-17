import "server-only";

import { getPool } from "./pool";
import type { FeedbackCategory } from "@/lib/feedback/types";

export async function insertTeacherFeedback(input: {
  id: string;
  teacherId: string;
  schoolId: string;
  category: FeedbackCategory;
  message: string;
  pageArea: string | null;
  gradesSnapshot: string[];
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO teacher_feedback (
       id,
       teacher_id,
       school_id,
       category,
       message,
       page_area,
       grades_snapshot
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.id,
      input.teacherId,
      input.schoolId,
      input.category,
      input.message,
      input.pageArea,
      input.gradesSnapshot,
    ],
  );
}
