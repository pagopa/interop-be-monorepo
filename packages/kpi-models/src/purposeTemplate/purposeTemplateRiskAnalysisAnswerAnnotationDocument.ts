import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";

export const PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema =
  createSelectSchema(
    purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
  ).extend({
    deleted: z.boolean().default(false).optional(),
  });
export type PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSchema
>;
