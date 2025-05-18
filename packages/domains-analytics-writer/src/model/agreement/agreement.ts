import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { agreementInReadmodelAgreement } from "pagopa-interop-readmodel-models";

export const AgreementSchema = createSelectSchema(
  agreementInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementSchema = z.infer<typeof AgreementSchema>;

export const AgreementDeletingSchema = AgreementSchema.pick({
  id: true,
  deleted: true,
});
export type AgreementDeletingSchema = z.infer<typeof AgreementDeletingSchema>;
