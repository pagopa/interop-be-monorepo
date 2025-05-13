import { TenantDeclaredAttributeSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantDeclaredAttributeSchema = z.object({
  attribute_id: z.string(),
  tenant_id: z.string(),
  metadata_version: z.number(),
  assignment_timestamp: z.string(),
  revocation_timestamp: z.string().nullable(),
  delegation_id: z.string().nullable(),
  deleted: z.boolean().default(false),
});
export type TenantDeclaredAttributeSchema = z.infer<
  typeof TenantDeclaredAttributeSchema
>;
export type TenantDeclaredAttributeMapping = {
  [K in keyof TenantDeclaredAttributeSchema]: (
    record: TenantDeclaredAttributeSQL
  ) => TenantDeclaredAttributeSchema[K];
};

export const TenantDeclaredAttributeDeletingSchema = z.object({
  attribute_id: z.string(),
  tenant_id: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantDeclaredAttributeDeletingSchema = z.infer<
  typeof TenantDeclaredAttributeDeletingSchema
>;
