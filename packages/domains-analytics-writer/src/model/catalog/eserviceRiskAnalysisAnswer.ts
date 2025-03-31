import { EServiceRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceRiskAnalysisAnswerSchema = z.object({
  id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  risk_analysis_form_id: z.string(),
  kind: z.string(),
  key: z.string(),
  value: z.string(),
});

type EserviceRiskAnalysisAnswerSchema = z.infer<
  typeof eserviceRiskAnalysisAnswerSchema
>;

export type EserviceRiskAnalysisAnswerMapping = {
  [K in keyof EserviceRiskAnalysisAnswerSchema]: (
    record: EServiceRiskAnalysisAnswerSQL
  ) => EserviceRiskAnalysisAnswerSchema[K];
};
