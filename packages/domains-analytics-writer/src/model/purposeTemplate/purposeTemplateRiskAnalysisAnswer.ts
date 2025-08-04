import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";

export const PurposeTemplateRiskAnalysisAnswerSchema = createSelectSchema(
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeTemplateRiskAnalysisAnswerSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisAnswerSchema
>;
