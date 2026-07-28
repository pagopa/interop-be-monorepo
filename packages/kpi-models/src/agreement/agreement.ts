import { createSelectSchema } from "drizzle-zod";
import { agreementInReadmodelAgreement } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const AgreementSchema = createSelectSchema(
  agreementInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementSchema = z.infer<typeof AgreementSchema>;
