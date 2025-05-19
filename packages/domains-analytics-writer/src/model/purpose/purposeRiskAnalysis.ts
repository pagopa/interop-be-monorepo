import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { purposeRiskAnalysisFormInReadmodelPurpose } from "pagopa-interop-readmodel-models";

export const PurposeRiskAnalysisFormSchema = createSelectSchema(
  purposeRiskAnalysisFormInReadmodelPurpose
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type PurposeRiskAnalysisFormSchema = z.infer<
  typeof PurposeRiskAnalysisFormSchema
>;

export const PurposeRiskAnalysisFormDeletingSchema =
  PurposeRiskAnalysisFormSchema.pick({
    id: true,
    deleted: true,
  });
export type PurposeRiskAnalysisFormDeletingSchema = z.infer<
  typeof PurposeRiskAnalysisFormDeletingSchema
>;
