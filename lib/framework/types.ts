import { z } from "zod";

export const FrameworkThemeSchema = z.enum([
  "meaning_making",
  "language_development",
  "effective_expression",
  "content_knowledge",
  "foundational_skills",
]);
export type FrameworkTheme = z.infer<typeof FrameworkThemeSchema>;

export const EldModeSchema = z.enum(["integrated", "designated"]);
export type EldMode = z.infer<typeof EldModeSchema>;

export const GradeBandSchema = z.enum(["TK-1", "2-3", "4-5", "6-8", "9-12"]);
export type GradeBand = z.infer<typeof GradeBandSchema>;

export const FrameworkMoveSchema = z.object({
  theme: FrameworkThemeSchema,
  eld_mode: EldModeSchema,
  move: z.string().min(1),
  language_target: z.string().optional(),
  framework_anchor: z.string().min(1),
  source_section: z.string().optional(),
  grade_band: GradeBandSchema.optional(),
  source_chapter: z.number().int().min(3).max(7).optional(),
});
export type FrameworkMove = z.infer<typeof FrameworkMoveSchema>;

export const FrameworkLevelMovesSchema = z
  .object({
    "1": z.array(FrameworkMoveSchema),
    "2": z.array(FrameworkMoveSchema),
    "3": z.array(FrameworkMoveSchema),
    "4": z.array(FrameworkMoveSchema),
  })
  .partial();
export type FrameworkLevelMoves = z.infer<typeof FrameworkLevelMovesSchema>;

export const FrameworkGradeSpanSchema = z
  .object({
    K: FrameworkLevelMovesSchema,
    "1-2": FrameworkLevelMovesSchema,
    "3-12": FrameworkLevelMovesSchema,
  })
  .partial();
export type FrameworkGradeSpan = z.infer<typeof FrameworkGradeSpanSchema>;

export const FrameworkMovesSchema = z.object({
  _meta: z
    .object({
      source: z.string(),
      source_url: z.string().url(),
      coverage: z.array(z.string()).optional(),
      scope_note: z.string().optional(),
    })
    .optional(),
  writing_moves: FrameworkGradeSpanSchema,
});
export type FrameworkMoves = z.infer<typeof FrameworkMovesSchema>;
