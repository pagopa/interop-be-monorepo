import { createSelectSchema } from "drizzle-zod";
import { purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeTemplateRiskAnalysisAnswerSchema = createSelectSchema(
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate
)
  .omit({ value: true, suggestedValues: true })
  .extend({
    deleted: z.boolean().default(false).optional(),
    suggestedValues: z
      .array(z.string())
      .transform((val) => JSON.stringify(val))
      .pipe(z.string())
      .nullable(),
    value: z
      .array(z.string())
      .transform((val) => JSON.stringify(val))
      .pipe(z.string()),
  });
export type PurposeTemplateRiskAnalysisAnswerSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisAnswerSchema
>;
