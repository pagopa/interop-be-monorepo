import { z } from "zod";
import { TenantCertifiedAttributeSQL } from "pagopa-interop-readmodel-models";

export const TenantCertifiedAttributeSchema = z.object({
  attribute_id: z.string(),
  tenant_id: z.string(),
  metadata_version: z.number(),
  assignment_timestamp: z.string(),
  revocation_timestamp: z.string().nullable(),
  deleted: z.boolean().default(false),
});
export type TenantCertifiedAttributeSchema = z.infer<
  typeof TenantCertifiedAttributeSchema
>;

export const TenantCertifiedAttributeDeletingSchema = z.object({
  attribute_id: z.string(),
  tenant_id: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantCertifiedAttributeDeletingSchema = z.infer<
  typeof TenantCertifiedAttributeDeletingSchema
>;

export type TenantCertifiedAttributeMapping = {
  [K in keyof TenantCertifiedAttributeSchema]: (
    record: TenantCertifiedAttributeSQL
  ) => TenantCertifiedAttributeSchema[K];
};
