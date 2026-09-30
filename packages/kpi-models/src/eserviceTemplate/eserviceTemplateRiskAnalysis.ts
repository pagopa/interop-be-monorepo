import { createSelectSchema } from "drizzle-zod";
import { eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceTemplateRiskAnalysisSchema = createSelectSchema(
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});

export type EserviceTemplateRiskAnalysisSchema = z.infer<
  typeof EserviceTemplateRiskAnalysisSchema
>;
