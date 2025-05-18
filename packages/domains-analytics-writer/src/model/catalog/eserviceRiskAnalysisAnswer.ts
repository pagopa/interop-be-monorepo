import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceRiskAnalysisAnswerInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceRiskAnalysisAnswerSchema = createSelectSchema(
  eserviceRiskAnalysisAnswerInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
  value: z.string(),
});
export type EserviceRiskAnalysisAnswerSchema = z.infer<
  typeof EserviceRiskAnalysisAnswerSchema
>;
