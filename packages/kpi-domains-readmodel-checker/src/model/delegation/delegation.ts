import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { delegationInReadmodelDelegation } from "pagopa-interop-readmodel-models";

export const DelegationSchema = createSelectSchema(
  delegationInReadmodelDelegation
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type DelegationSchema = z.infer<typeof DelegationSchema>;
