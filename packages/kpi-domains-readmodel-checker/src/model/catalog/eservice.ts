import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceInReadmodelCatalog } from "pagopa-interop-readmodel-models";
import { EserviceDescriptorSchema } from "./eserviceDescriptor.js";
import { EserviceDescriptorAttributeSchema } from "./eserviceDescriptorAttribute.js";
import { EserviceDescriptorDocumentSchema } from "./eserviceDescriptorDocument.js";
import { EserviceDescriptorInterfaceSchema } from "./eserviceDescriptorInterface.js";
import { EserviceDescriptorRejectionReasonSchema } from "./eserviceDescriptorRejection.js";
import { EserviceDescriptorTemplateVersionRefSchema } from "./eserviceDescriptorTemplateVersionRef.js";
import { EserviceRiskAnalysisSchema } from "./eserviceRiskAnalysis.js";
import { EserviceRiskAnalysisAnswerSchema } from "./eserviceRiskAnalysisAnswer.js";

export const EserviceSchema = createSelectSchema(
  eserviceInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceSchema = z.infer<typeof EserviceSchema>;

export const EserviceItemsSchema = z.object({
  eserviceSQL: EserviceSchema,
  riskAnalysesSQL: z.array(EserviceRiskAnalysisSchema),
  riskAnalysisAnswersSQL: z.array(EserviceRiskAnalysisAnswerSchema),
  descriptorsSQL: z.array(EserviceDescriptorSchema),
  attributesSQL: z.array(EserviceDescriptorAttributeSchema),
  interfacesSQL: z.array(EserviceDescriptorInterfaceSchema),
  documentsSQL: z.array(EserviceDescriptorDocumentSchema),
  rejectionReasonsSQL: z.array(EserviceDescriptorRejectionReasonSchema),
  templateVersionRefsSQL: z.array(EserviceDescriptorTemplateVersionRefSchema),
});
export type EserviceItemsSchema = z.infer<typeof EserviceItemsSchema>;
