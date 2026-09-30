import { createSelectSchema } from "drizzle-zod";
import { delegationContractDocumentInReadmodelDelegation } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const DelegationContractDocumentSchema = createSelectSchema(
  delegationContractDocumentInReadmodelDelegation
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type DelegationContractDocumentSchema = z.infer<
  typeof DelegationContractDocumentSchema
>;
