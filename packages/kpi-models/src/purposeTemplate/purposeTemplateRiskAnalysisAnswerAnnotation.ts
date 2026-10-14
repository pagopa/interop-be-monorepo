import { createSelectSchema } from "drizzle-zod";
import { purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeTemplateRiskAnalysisAnswerAnnotationSchema =
  createSelectSchema(
    purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate
  ).extend({
    deleted: z.boolean().default(false).optional(),
  });
export type PurposeTemplateRiskAnalysisAnswerAnnotationSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisAnswerAnnotationSchema
>;
