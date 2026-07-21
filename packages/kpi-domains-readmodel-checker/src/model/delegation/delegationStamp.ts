import { createSelectSchema } from "drizzle-zod";
import { delegationStampInReadmodelDelegation } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const DelegationStampSchema = createSelectSchema(
  delegationStampInReadmodelDelegation
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type DelegationStampSchema = z.infer<typeof DelegationStampSchema>;
