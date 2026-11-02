import { createSelectSchema } from "drizzle-zod";
import { agreementContractInReadmodelAgreement } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const AgreementContractSchema = createSelectSchema(
  agreementContractInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementContractSchema = z.infer<typeof AgreementContractSchema>;
