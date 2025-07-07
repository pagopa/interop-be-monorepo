import { tenantInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const TenantSchema = createSelectSchema(tenantInReadmodelTenant).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantSchema = z.infer<typeof TenantSchema>;
