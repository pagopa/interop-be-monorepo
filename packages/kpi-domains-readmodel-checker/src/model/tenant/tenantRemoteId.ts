import { z } from "zod";
import { tenantRemoteIdInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { createSelectSchema } from "drizzle-zod";

export const TenantRemoteIdSchema = createSelectSchema(
  tenantRemoteIdInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantRemoteIdSchema = z.infer<typeof TenantRemoteIdSchema>;
