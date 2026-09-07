import { createSelectSchema } from "drizzle-zod";
import { tenantMailInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantMailSchema = createSelectSchema(
  tenantMailInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantMailSchema = z.infer<typeof TenantMailSchema>;
