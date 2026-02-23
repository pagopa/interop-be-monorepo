import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceRiskAnalysisAnswerInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceRiskAnalysisAnswerSchema = createSelectSchema(
  eserviceRiskAnalysisAnswerInReadmodelCatalog
)
  .omit({ value: true })
  .extend({
    deleted: z.boolean().default(false).optional(),
    value: z
      .array(z.string())
      .transform((val) => JSON.stringify(val))
      .pipe(z.string()),
  });
export type EserviceRiskAnalysisAnswerSchema = z.infer<
  typeof EserviceRiskAnalysisAnswerSchema
>;
