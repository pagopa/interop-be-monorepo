import { EServiceRiskAnalysisSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceRiskAnalysisSchema = z.object({
  id: z.string(),
  metadata_version: z.number(),
  eservice_id: z.string(),
  name: z.string(),
  created_at: z.string(),
  risk_analysis_form_id: z.string(),
  risk_analysis_form_version: z.string(),
});
export type EserviceRiskAnalysisSchema = z.infer<
  typeof EserviceRiskAnalysisSchema
>;

export type EserviceRiskAnalysisMapping = {
  [K in keyof EserviceRiskAnalysisSchema]: (
    record: EServiceRiskAnalysisSQL
  ) => EserviceRiskAnalysisSchema[K];
};

export const EserviceRiskAnalysisDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});
export type EserviceRiskAnalysisDeletingSchema = z.infer<
  typeof EserviceRiskAnalysisDeletingSchema
>;
