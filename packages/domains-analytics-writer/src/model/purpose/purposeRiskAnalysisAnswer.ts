import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeRiskAnalysisAnswerInReadmodelPurpose } from "pagopa-interop-readmodel-models";

export const PurposeRiskAnalysisAnswerSchema = createSelectSchema(
  purposeRiskAnalysisAnswerInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeRiskAnalysisAnswerSchema = z.infer<
  typeof PurposeRiskAnalysisAnswerSchema
>;
