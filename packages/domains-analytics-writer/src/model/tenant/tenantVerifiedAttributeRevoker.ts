import { TenantVerifiedAttributeRevokerSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantVerifiedAttributeRevokerSchema = z.object({
  tenant_id: z.string(),
  metadata_version: z.number(),
  tenant_revoker_id: z.string(),
  tenant_verified_attribute_id: z.string(),
  verification_date: z.string(),
  expiration_date: z.string().nullable(),
  extension_date: z.string().nullable(),
  revocation_date: z.string(),
  delegation_id: z.string().nullable(),
  deleted: z.boolean().default(false),
});
export type TenantVerifiedAttributeRevokerSchema = z.infer<
  typeof TenantVerifiedAttributeRevokerSchema
>;

export const TenantVerifiedAttributeRevokerDeletingSchema = z.object({
  tenant_id: z.string(),
  tenant_verified_attribute_id: z.string(),
  tenant_revoker_id: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantVerifiedAttributeRevokerDeletingSchema = z.infer<
  typeof TenantVerifiedAttributeRevokerDeletingSchema
>;

export type TenantVerifiedAttributeRevokerMapping = {
  [K in keyof TenantVerifiedAttributeRevokerSchema]: (
    record: TenantVerifiedAttributeRevokerSQL
  ) => TenantVerifiedAttributeRevokerSchema[K];
};
