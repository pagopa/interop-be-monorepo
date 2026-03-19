import { z } from "zod";
import { tenantFeatureInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { createSelectSchema } from "drizzle-zod";

export const TenantFeatureSchema = createSelectSchema(
  tenantFeatureInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantFeatureSchema = z.infer<typeof TenantFeatureSchema>;
