import { createSelectSchema } from "drizzle-zod";
import { purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeTemplateRiskAnalysisFormSchema = createSelectSchema(
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeTemplateRiskAnalysisFormSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisFormSchema
>;
