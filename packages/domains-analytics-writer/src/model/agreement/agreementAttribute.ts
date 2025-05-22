import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { agreementAttributeInReadmodelAgreement } from "pagopa-interop-readmodel-models";

export const AgreementAttributeSchema = createSelectSchema(
  agreementAttributeInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementAttributeSchema = z.infer<typeof AgreementAttributeSchema>;
