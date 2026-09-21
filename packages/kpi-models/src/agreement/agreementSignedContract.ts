import { createSelectSchema } from "drizzle-zod";
import { agreementSignedContractInReadmodelAgreement } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const AgreementSignedContractSchema = createSelectSchema(
  agreementSignedContractInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementSignedContractSchema = z.infer<
  typeof AgreementSignedContractSchema
>;
