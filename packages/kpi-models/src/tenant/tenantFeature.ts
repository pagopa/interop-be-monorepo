import { createSelectSchema } from "drizzle-zod";
import { tenantFeatureInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantFeatureSchema = createSelectSchema(
  tenantFeatureInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantFeatureSchema = z.infer<typeof TenantFeatureSchema>;
