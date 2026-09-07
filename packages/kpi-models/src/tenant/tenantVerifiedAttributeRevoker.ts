import { createSelectSchema } from "drizzle-zod";
import { tenantVerifiedAttributeRevokerInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantVerifiedAttributeRevokerSchema = createSelectSchema(
  tenantVerifiedAttributeRevokerInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantVerifiedAttributeRevokerSchema = z.infer<
  typeof TenantVerifiedAttributeRevokerSchema
>;
