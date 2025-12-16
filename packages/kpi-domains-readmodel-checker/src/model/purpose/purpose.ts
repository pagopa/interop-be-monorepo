import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { PurposeRiskAnalysisFormSchema } from "./purposeRiskAnalysis.js";
import { PurposeRiskAnalysisAnswerSchema } from "./purposeRiskAnalysisAnswer.js";
import { PurposeVersionSchema } from "./purposeVersion.js";
import { PurposeVersionDocumentSchema } from "./purposeVersionDocument.js";
import { PurposeVersionSignedDocumentSchema } from "./purposeVersionSignedDocument.js";

export const PurposeSchema = createSelectSchema(
  purposeInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeSchema = z.infer<typeof PurposeSchema>;

export const PurposeItemsSchema = z.object({
  purposeSQL: PurposeSchema,
  riskAnalysisFormSQL: PurposeRiskAnalysisFormSchema.optional(),
  riskAnalysisAnswersSQL: z.array(PurposeRiskAnalysisAnswerSchema).optional(),
  versionsSQL: z.array(PurposeVersionSchema),
  versionDocumentsSQL: z.array(PurposeVersionDocumentSchema),
  versionSignedDocumentsSQL: z.array(PurposeVersionSignedDocumentSchema),
});
export type PurposeItemsSchema = z.infer<typeof PurposeItemsSchema>;
