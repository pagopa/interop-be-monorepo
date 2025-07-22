import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate } from "pagopa-interop-readmodel-models";

export const EserviceTemplateRiskAnalysisAnswerSchema = createSelectSchema(
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate
)
  .omit({ value: true })
  .extend({
    deleted: z.boolean().default(false).optional(),
    value: z
      .array(z.string())
      .transform((val) => JSON.stringify(val))
      .pipe(z.string()),
  });
export type EserviceTemplateRiskAnalysisAnswerSchema = z.infer<
  typeof EserviceTemplateRiskAnalysisAnswerSchema
>;
