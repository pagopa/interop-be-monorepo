import { createSelectSchema } from "drizzle-zod";
import { agreementConsumerDocumentInReadmodelAgreement } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const AgreementConsumerDocumentSchema = createSelectSchema(
  agreementConsumerDocumentInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementConsumerDocumentSchema = z.infer<
  typeof AgreementConsumerDocumentSchema
>;

export const AgreementConsumerDocumentDeletingSchema =
  AgreementConsumerDocumentSchema.pick({
    id: true,
    deleted: true,
  });

export type AgreementConsumerDocumentDeletingSchema = z.infer<
  typeof AgreementConsumerDocumentDeletingSchema
>;
