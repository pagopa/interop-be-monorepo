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

export const TenantVerifiedAttributeRevokerDeletingSchema =
  TenantVerifiedAttributeRevokerSchema.pick({
    tenantId: true,
    tenantVerifiedAttributeId: true,
    tenantRevokerId: true,
    deleted: true,
  });
export type TenantVerifiedAttributeRevokerDeletingSchema = z.infer<
  typeof TenantVerifiedAttributeRevokerDeletingSchema
>;
