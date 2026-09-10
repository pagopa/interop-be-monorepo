import { createSelectSchema } from "drizzle-zod";
import { agreementStampInReadmodelAgreement } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const AgreementStampSchema = createSelectSchema(
  agreementStampInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementStampSchema = z.infer<typeof AgreementStampSchema>;
