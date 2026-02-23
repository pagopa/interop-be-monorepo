import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { agreementConsumerDocumentInReadmodelAgreement } from "pagopa-interop-readmodel-models";

export const AgreementConsumerDocumentSchema = createSelectSchema(
  agreementConsumerDocumentInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementConsumerDocumentSchema = z.infer<
  typeof AgreementConsumerDocumentSchema
>;
