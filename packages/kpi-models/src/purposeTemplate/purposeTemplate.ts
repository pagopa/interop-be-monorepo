import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";
import { PurposeTemplateRiskAnalysisAnswerSchema } from "./purposeTemplateRiskAnalysisAnswer.js";
import { PurposeTemplateRiskAnalysisAnswerAnnotationSchema } from "./purposeTemplateRiskAnalysisAnswerAnnotation.js";
import { PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema } from "./purposeTemplateRiskAnalysisAnswerAnnotationDocument.js";
import { PurposeTemplateRiskAnalysisFormSchema } from "./purposeTemplateRiskAnalysisForm.js";

export const PurposeTemplateSchema = createSelectSchema(
  purposeTemplateInReadmodelPurposeTemplate
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeTemplateSchema = z.infer<typeof PurposeTemplateSchema>;

export const PurposeTemplateItemsSchema = z.object({
  purposeTemplateSQL: PurposeTemplateSchema,
  riskAnalysisFormTemplateSQL: PurposeTemplateRiskAnalysisFormSchema.optional(),
  riskAnalysisTemplateAnswersSQL: z.array(
    PurposeTemplateRiskAnalysisAnswerSchema
  ),
  riskAnalysisTemplateAnswersAnnotationsSQL: z.array(
    PurposeTemplateRiskAnalysisAnswerAnnotationSchema
  ),
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: z.array(
    PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema
  ),
});

export type PurposeTemplateItemsSchema = z.infer<
  typeof PurposeTemplateItemsSchema
>;
