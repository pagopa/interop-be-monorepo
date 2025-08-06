import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";
import { EserviceTemplateRiskAnalysisSchema } from "./eserviceTemplateRiskAnalysis.js";
import { EserviceTemplateRiskAnalysisAnswerSchema } from "./eserviceTemplateRiskAnalysisAnswer.js";
import { EserviceTemplateVersionSchema } from "./eserviceTemplateVersion.js";
import { EserviceTemplateVersionAttributeSchema } from "./eserviceTemplateVersionAttribute.js";
import { EserviceTemplateVersionDocumentSchema } from "./eserviceTemplateVersionDocument.js";
import { EserviceTemplateVersionInterfaceSchema } from "./eserviceTemplateVersionInterface.js";

export const EserviceTemplateSchema = createSelectSchema(
  eserviceTemplateInReadmodelEserviceTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceTemplateSchema = z.infer<typeof EserviceTemplateSchema>;

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
