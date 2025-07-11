import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { agreementStampInReadmodelAgreement } from "pagopa-interop-readmodel-models";

export const AgreementStampSchema = createSelectSchema(
  agreementStampInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementStampSchema = z.infer<typeof AgreementStampSchema>;
