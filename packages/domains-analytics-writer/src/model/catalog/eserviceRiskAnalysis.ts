import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  eserviceRiskAnalysisInReadmodelCatalog,
  EServiceRiskAnalysisSQL,
} from "pagopa-interop-readmodel-models";

export const EserviceRiskAnalysisSchema = createSelectSchema(
  eserviceRiskAnalysisInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceRiskAnalysisSchema = z.infer<
  typeof EserviceRiskAnalysisSchema
>;

export type EserviceRiskAnalysisMapping = {
  [K in keyof EserviceRiskAnalysisSchema]: (
    record: EServiceRiskAnalysisSQL
  ) => EserviceRiskAnalysisSchema[K];
};

export const EserviceRiskAnalysisDeletingSchema =
  EserviceRiskAnalysisSchema.pick({
    id: true,
    eserviceId: true,
    deleted: true,
  });
export type EserviceRiskAnalysisDeletingSchema = z.infer<
  typeof EserviceRiskAnalysisDeletingSchema
>;

export type EserviceRiskAnalysisDeletingMapping = {
  [K in keyof EserviceRiskAnalysisDeletingSchema]: (
    record: Pick<EServiceRiskAnalysisSQL, "id" | "eserviceId">
  ) => EserviceRiskAnalysisDeletingSchema[K];
};
