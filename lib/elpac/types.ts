import { z } from "zod";

export const PldLevelSchema = z.object({
  label: z.string(),
  frequency_marker: z.string(),
  descriptors: z.array(z.string()).min(1),
});

export const PldGradeSpanSchema = z.object({
  "1": PldLevelSchema,
  "2": PldLevelSchema,
  "3": PldLevelSchema,
  "4": PldLevelSchema,
});

export const ElPacPldsSchema = z.object({
  range_plds: z.object({
    writing: z.object({
      K: PldGradeSpanSchema,
      "1-2": PldGradeSpanSchema,
      "3-12": PldGradeSpanSchema,
    }),
  }),
});

export type ElPacPlds = z.infer<typeof ElPacPldsSchema>;
export type PldLevel = z.infer<typeof PldLevelSchema>;
export type GradeSpanKey = keyof ElPacPlds["range_plds"]["writing"];
