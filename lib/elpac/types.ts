import { z } from "zod";

export const PldLevelSchema = z.object({
  label: z.string(),
  frequency_marker: z.string(),
  descriptors: z.array(z.string()).min(1),
});

export const PldLevelSetSchema = z.object({
  "1": PldLevelSchema,
  "2": PldLevelSchema,
  "3": PldLevelSchema,
  "4": PldLevelSchema,
});

const WrittenDomainSchema = z.object({
  _notes: z.string().optional(),
  K: PldLevelSetSchema,
  "1-2": PldLevelSetSchema,
  "3-12": PldLevelSetSchema,
});

const OralDomainSchema = z.object({
  _notes: z.string().optional(),
  "K-2": PldLevelSetSchema,
  "3-12": PldLevelSetSchema,
});

export const ElPacPldsSchema = z.object({
  range_plds: z.object({
    writing: WrittenDomainSchema,
    reading: WrittenDomainSchema,
    speaking: OralDomainSchema,
    listening: OralDomainSchema,
  }),
});

export type ElPacPlds = z.infer<typeof ElPacPldsSchema>;
export type PldLevel = z.infer<typeof PldLevelSchema>;
export type PldLevelSet = z.infer<typeof PldLevelSetSchema>;
export type WrittenGradeSpanKey = keyof ElPacPlds["range_plds"]["writing"];
export type OralGradeSpanKey = keyof ElPacPlds["range_plds"]["speaking"];
