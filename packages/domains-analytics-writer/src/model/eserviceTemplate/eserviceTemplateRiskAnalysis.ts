import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

export const EserviceTemplateRiskAnalysisSchema = createSelectSchema(
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});

export type EserviceTemplateRiskAnalysisSchema = z.infer<
  typeof EserviceTemplateRiskAnalysisSchema
>;

export const EserviceTemplateRiskAnalysisDeletingSchema =
  EserviceTemplateRiskAnalysisSchema.pick({
    id: true,
    deleted: true,
  });
export type EserviceTemplateRiskAnalysisDeletingSchema = z.infer<
  typeof EserviceTemplateRiskAnalysisDeletingSchema
>;
