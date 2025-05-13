import { PurposeRiskAnalysisFormSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeRiskAnalysisFormSchema = z.object({
  id: z.string().uuid(),
  purpose_id: z.string().uuid(),
  metadata_version: z.number().int(),
  version: z.string(),
  risk_analysis_id: z.string().uuid().nullable(),
  deleted: z.boolean().default(false).optional(),
});
export type PurposeRiskAnalysisForm = z.infer<
  typeof PurposeRiskAnalysisFormSchema
>;
export type PurposeSchema = z.infer<typeof PurposeRiskAnalysisFormSchema>;

export type PurposeMapping = {
  [K in keyof PurposeSchema]: (
    record: PurposeRiskAnalysisFormSQL
  ) => PurposeSchema[K];
};
