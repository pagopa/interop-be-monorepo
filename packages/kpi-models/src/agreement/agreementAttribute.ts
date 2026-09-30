import { createSelectSchema } from "drizzle-zod";
import { agreementAttributeInReadmodelAgreement } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const AgreementAttributeSchema = createSelectSchema(
  agreementAttributeInReadmodelAgreement
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type AgreementAttributeSchema = z.infer<typeof AgreementAttributeSchema>;
