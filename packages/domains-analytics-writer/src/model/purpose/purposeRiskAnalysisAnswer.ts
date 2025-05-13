import { PurposeRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeRiskAnalysisAnswerSchema = z.object({
  id: z.string().uuid(),
  purpose_id: z.string().uuid(),
  metadata_version: z.number().int(),
  risk_analysis_form_id: z.string().uuid(),
  kind: z.string(),
  key: z.string(),
  value: z.array(z.string()).nullable(),
  deleted: z.boolean().default(false).optional(),
});

export type PurposeRiskAnalysisAnswerSchema = z.infer<
  typeof PurposeRiskAnalysisAnswerSchema
>;

export type PurposeRiskAnalysisAnswerMapping = {
  [K in keyof PurposeRiskAnalysisAnswerSchema]: (
    record: PurposeRiskAnalysisAnswerSQL
  ) => PurposeRiskAnalysisAnswerSchema[K];
};
