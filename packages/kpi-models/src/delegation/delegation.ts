import { createSelectSchema } from "drizzle-zod";
import { delegationInReadmodelDelegation } from "pagopa-interop-readmodel-models";
import { z } from "zod";

import { DelegationContractDocumentSchema } from "./delegationContractDocument.js";
import { DelegationSignedContractDocumentSchema } from "./delegationSignedContractDocument.js";
import { DelegationStampSchema } from "./delegationStamp.js";

export const DelegationSchema = createSelectSchema(
  delegationInReadmodelDelegation
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type DelegationSchema = z.infer<typeof DelegationSchema>;

export const DelegationItemsSchema = z.object({
  delegationSQL: DelegationSchema,
  stampsSQL: z.array(DelegationStampSchema),
  contractDocumentsSQL: z.array(DelegationContractDocumentSchema),
  contractSignedDocumentsSQL: z.array(DelegationSignedContractDocumentSchema),
});
export type DelegationItemsSchema = z.infer<typeof DelegationItemsSchema>;
