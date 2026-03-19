import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { agreementSignedContractInReadmodelAgreement } from "pagopa-interop-readmodel-models";

export const AgreementSignedContractSchema = createSelectSchema(
  agreementSignedContractInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementSignedContractSchema = z.infer<
  typeof AgreementSignedContractSchema
>;
