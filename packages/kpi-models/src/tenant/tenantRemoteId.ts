import { createSelectSchema } from "drizzle-zod";
import { tenantRemoteIdInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantRemoteIdSchema = createSelectSchema(
  tenantRemoteIdInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantRemoteIdSchema = z.infer<typeof TenantRemoteIdSchema>;
