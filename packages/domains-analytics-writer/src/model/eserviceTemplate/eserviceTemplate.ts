import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

import { EserviceTemplateVersionSchema } from "./eserviceTemplateVersion.js";
import { EserviceTemplateVersionInterfaceSchema } from "./eserviceTemplateVersionInterface.js";
import { EserviceTemplateVersionDocumentSchema } from "./eserviceTemplateVersionDocument.js";
import { EserviceTemplateVersionAttributeSchema } from "./eserviceTemplateVersionAttribute.js";
import { EserviceTemplateRiskAnalysisSchema } from "./eserviceTemplateRiskAnalysis.js";
import { EserviceTemplateRiskAnalysisAnswerSchema } from "./eserviceTemplateRiskAnalysisAnswer.js";

export const EserviceTemplateSchema = createSelectSchema(
  eserviceTemplateInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceTemplateSchema = z.infer<typeof EserviceTemplateSchema>;

export const EserviceTemplateDeletingSchema = EserviceTemplateSchema.pick({
  id: true,
  deleted: true,
});
export type EserviceTemplateDeletingSchema = z.infer<
  typeof EserviceTemplateDeletingSchema
>;

export const EserviceTemplateItemsSchema = z.object({
  eserviceTemplateSQL: EserviceTemplateSchema,
  versionsSQL: z.array(EserviceTemplateVersionSchema),
  interfacesSQL: z.array(EserviceTemplateVersionInterfaceSchema),
  documentsSQL: z.array(EserviceTemplateVersionDocumentSchema),
  attributesSQL: z.array(EserviceTemplateVersionAttributeSchema),
  riskAnalysesSQL: z.array(EserviceTemplateRiskAnalysisSchema),
  riskAnalysisAnswersSQL: z.array(EserviceTemplateRiskAnalysisAnswerSchema),
});
export type EserviceTemplateItemsSchema = z.infer<
  typeof EserviceTemplateItemsSchema
>;
