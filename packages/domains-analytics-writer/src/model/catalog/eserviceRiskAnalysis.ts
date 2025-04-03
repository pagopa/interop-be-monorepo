import { EServiceRiskAnalysisSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceRiskAnalysisSchema = z.object({
  id: z.string(),
  metadata_version: z.number(),
  eservice_id: z.string(),
  name: z.string(),
  created_at: z.string(),
  risk_analysis_form_id: z.string(),
  risk_analysis_form_version: z.string(),
});

type EserviceRiskAnalysisSchema = z.infer<typeof eserviceRiskAnalysisSchema>;

export type EserviceRiskAnalysisMapping = {
  [K in keyof EserviceRiskAnalysisSchema]: (
    record: EServiceRiskAnalysisSQL
  ) => EserviceRiskAnalysisSchema[K];
};

export const eserviceRiskAnalysisDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});
