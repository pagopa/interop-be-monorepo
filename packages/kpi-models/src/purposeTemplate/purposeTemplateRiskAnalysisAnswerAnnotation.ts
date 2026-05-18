import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";

export const PurposeTemplateRiskAnalysisAnswerAnnotationSchema =
  createSelectSchema(
    purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate
  ).extend({
    deleted: z.boolean().default(false).optional(),
  });
export type PurposeTemplateRiskAnalysisAnswerAnnotationSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisAnswerAnnotationSchema
>;
