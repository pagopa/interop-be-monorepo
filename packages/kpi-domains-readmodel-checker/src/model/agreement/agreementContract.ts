import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { agreementContractInReadmodelAgreement } from "pagopa-interop-readmodel-models";

export const AgreementContractSchema = createSelectSchema(
  agreementContractInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementContractSchema = z.infer<typeof AgreementContractSchema>;
