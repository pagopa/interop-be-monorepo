import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { delegationSignedContractDocumentInReadmodelDelegation } from "pagopa-interop-readmodel-models";

export const DelegationSignedContractDocumentSchema = createSelectSchema(
  delegationSignedContractDocumentInReadmodelDelegation
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type DelegationSignedContractDocumentSchema = z.infer<
  typeof DelegationSignedContractDocumentSchema
>;
