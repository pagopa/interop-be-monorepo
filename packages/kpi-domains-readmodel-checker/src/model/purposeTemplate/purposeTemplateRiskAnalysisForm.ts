import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";

export const PurposeTemplateRiskAnalysisFormSchema = createSelectSchema(
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeTemplateRiskAnalysisFormSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisFormSchema
>;
