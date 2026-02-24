import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { delegationContractDocumentInReadmodelDelegation } from "pagopa-interop-readmodel-models";

export const DelegationContractDocumentSchema = createSelectSchema(
  delegationContractDocumentInReadmodelDelegation
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type DelegationContractDocumentSchema = z.infer<
  typeof DelegationContractDocumentSchema
>;
