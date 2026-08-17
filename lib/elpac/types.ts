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

const DomainPldBlockSchema = z
  .object({
    _notes: z.string().optional(),
    K: PldGradeSpanSchema.optional(),
    "1-2": PldGradeSpanSchema.optional(),
    "3-12": PldGradeSpanSchema.optional(),
    "K-2": PldGradeSpanSchema.optional(),
  })
  .passthrough();

const GeneralPldLevelSchema = z.object({
  label: z.string(),
  ca_eld_equivalent: z.string(),
  summary: z.string(),
  support_familiar_contexts: z.string(),
  support_unfamiliar_contexts: z.string(),
});

const GeneralPldsSchema = z.object({
  description: z.string(),
  levels: z.object({
    "1": GeneralPldLevelSchema,
    "2": GeneralPldLevelSchema,
    "3": GeneralPldLevelSchema,
    "4": GeneralPldLevelSchema,
  }),
});

export const ElPacPldsSchema = z.object({
  general_plds: GeneralPldsSchema.optional(),
  range_plds: z.object({
    writing: DomainPldBlockSchema,
    reading: DomainPldBlockSchema,
    listening: DomainPldBlockSchema,
    speaking: DomainPldBlockSchema,
  }),
});

export type ElPacPlds = z.infer<typeof ElPacPldsSchema>;
export type GeneralPlds = z.infer<typeof GeneralPldsSchema>;
export type PldLevel = z.infer<typeof PldLevelSchema>;
export type GradeSpanKey = "K" | "1-2" | "3-12" | "K-2";
