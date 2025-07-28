import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";

export const PurposeTemplateRiskAnalysisAnswerAnnotationSchema =
  createSelectSchema(
    purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate
  ).extend({
    deleted: z.boolean().default(false).optional(),
    urls: z
      .any()
      .transform((val) => (Array.isArray(val) ? val : []))
      .pipe(z.array(z.string()))
      .transform((val) => JSON.stringify(val))
      .pipe(z.string()),
  });
export type PurposeTemplateRiskAnalysisAnswerAnnotationSchema = z.infer<
  typeof PurposeTemplateRiskAnalysisAnswerAnnotationSchema
>;
