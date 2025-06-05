import { createSelectSchema } from "drizzle-zod";
import { tenantVerifiedAttributeInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantVerifiedAttributeSchema = createSelectSchema(
  tenantVerifiedAttributeInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantVerifiedAttributeSchema = z.infer<
  typeof TenantVerifiedAttributeSchema
>;

export const TenantVerifiedAttributeDeletingSchema =
  TenantVerifiedAttributeSchema.pick({
    attributeId: true,
    tenantId: true,
    deleted: true,
  });
export type TenantVerifiedAttributeDeletingSchema = z.infer<
  typeof TenantVerifiedAttributeDeletingSchema
>;
