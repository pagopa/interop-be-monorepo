import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceRiskAnalysisInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceRiskAnalysisSchema = createSelectSchema(
  eserviceRiskAnalysisInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceRiskAnalysisSchema = z.infer<
  typeof EserviceRiskAnalysisSchema
>;

export const EserviceRiskAnalysisDeletingSchema =
  EserviceRiskAnalysisSchema.pick({
    id: true,
    eserviceId: true,
    deleted: true,
  });
export type EserviceRiskAnalysisDeletingSchema = z.infer<
  typeof EserviceRiskAnalysisDeletingSchema
>;
