import { createSelectSchema } from "drizzle-zod";
import { tenantDeclaredAttributeInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantDeclaredAttributeSchema = createSelectSchema(
  tenantDeclaredAttributeInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantDeclaredAttributeSchema = z.infer<
  typeof TenantDeclaredAttributeSchema
>;

export const TenantDeclaredAttributeDeletingSchema =
  TenantDeclaredAttributeSchema.pick({
    attributeId: true,
    tenantId: true,
    deleted: true,
  });
export type TenantDeclaredAttributeDeletingSchema = z.infer<
  typeof TenantDeclaredAttributeDeletingSchema
>;
