import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { PurposeRiskAnalysisFormSchema } from "./purposeRiskAnalysis.js";
import { PurposeRiskAnalysisAnswerSchema } from "./purposeRiskAnalysisAnswer.js";
import { PurposeVersionSchema } from "./purposeVersion.js";
import { PurposeVersionDocumentSchema } from "./purposeVersionDocument.js";
import { PurposeVersionStampSchema } from "./purposeVersionStamp.js";

export const PurposeSchema = createSelectSchema(
  purposeInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeSchema = z.infer<typeof PurposeSchema>;

export const PurposeDeletingSchema = PurposeSchema.pick({
  id: true,
  deleted: true,
});
export type PurposeDeletingSchema = z.infer<typeof PurposeDeletingSchema>;

export const PurposeItemsSchema = z.object({
  purposeSQL: PurposeSchema,
  riskAnalysisFormSQL: PurposeRiskAnalysisFormSchema.optional(),
  riskAnalysisAnswersSQL: z.array(PurposeRiskAnalysisAnswerSchema).optional(),
  versionsSQL: z.array(PurposeVersionSchema),
  versionDocumentsSQL: z.array(PurposeVersionDocumentSchema),
  versionStampsSQL: z.array(PurposeVersionStampSchema),
});
export type PurposeItemsSchema = z.infer<typeof PurposeItemsSchema>;
