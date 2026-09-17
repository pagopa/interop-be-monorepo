import { createSelectSchema } from "drizzle-zod";
import { riskAnalysisReviewerInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeRiskAnalysisReviewerSchema = createSelectSchema(
  riskAnalysisReviewerInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeRiskAnalysisReviewerSchema = z.infer<
  typeof PurposeRiskAnalysisReviewerSchema
>;
