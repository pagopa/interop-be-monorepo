import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeRiskAnalysisAnswerInReadmodelPurpose } from "pagopa-interop-readmodel-models";

export const PurposeRiskAnalysisAnswerSchema = createSelectSchema(
  purposeRiskAnalysisAnswerInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
  value: z
    .array(z.string())
    .transform((val) => JSON.stringify(val))
    .pipe(z.string())
    .nullish(),
});
export type PurposeRiskAnalysisAnswerSchema = z.infer<
  typeof PurposeRiskAnalysisAnswerSchema
>;
