import { TenantVerifiedAttributeSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantVerifiedAttributeSchema = z.object({
  attribute_id: z.string(),
  tenant_id: z.string(),
  metadata_version: z.number(),
  assignment_timestamp: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantVerifiedAttributeSchema = z.infer<
  typeof TenantVerifiedAttributeSchema
>;

export const TenantVerifiedAttributeDeletingSchema = z.object({
  attribute_id: z.string(),
  tenant_id: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantVerifiedAttributeDeletingSchema = z.infer<
  typeof TenantVerifiedAttributeDeletingSchema
>;

export type TenantVerifiedAttributeMapping = {
  [K in keyof TenantVerifiedAttributeSchema]: (
    record: TenantVerifiedAttributeSQL
  ) => TenantVerifiedAttributeSchema[K];
};
