import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";

export const PurposeTemplateRiskAnalysisAnswerSchema = createSelectSchema(
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
  suggestedValues: z
    .array(z.string())
    .transform((val) => JSON.stringify(val))
    .pipe(z.string())
    .nullish(),
  value: z
    .array(z.string())
    .transform((val) => JSON.stringify(val))
    .pipe(z.string())
    .nullish(),
});
export type PurposeTemplateRiskAnalysisAnswerSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisAnswerSchema
>;
