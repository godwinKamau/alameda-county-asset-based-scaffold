import { z } from "zod";

export const MAX_FEEDBACK_MESSAGE_LENGTH = 2000;

export const FeedbackCategorySchema = z.enum([
  "bug",
  "feature_request",
  "confusing_ui",
  "result_accuracy",
  "other",
]);

export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;

export const FEEDBACK_CATEGORIES = FeedbackCategorySchema.options;

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Bug / something broken",
  feature_request: "Feature request",
  confusing_ui: "Confusing UI",
  result_accuracy: "Result accuracy",
  other: "Other",
};

export const FeedbackAreaSchema = z.enum([
  "dashboard",
  "students",
  "analyze",
  "results",
  "saved",
  "progress",
  "admin",
  "not_specific",
]);

export type FeedbackArea = z.infer<typeof FeedbackAreaSchema>;

export const FEEDBACK_AREAS = FeedbackAreaSchema.options;

export const FEEDBACK_AREA_LABELS: Record<FeedbackArea, string> = {
  dashboard: "Dashboard",
  students: "Students",
  analyze: "Analyze",
  results: "Results",
  saved: "Saved Insights",
  progress: "Progress",
  admin: "Admin",
  not_specific: "Not specific",
};

export const CreateFeedbackSchema = z.object({
  category: FeedbackCategorySchema,
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(MAX_FEEDBACK_MESSAGE_LENGTH),
  page_area: FeedbackAreaSchema.nullable().optional(),
});

export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;
