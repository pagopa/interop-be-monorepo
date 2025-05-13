import { TenantVerifiedAttributeVerifierSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantVerifiedAttributeVerifierSchema = z.object({
  tenant_id: z.string(),
  metadata_version: z.number(),
  tenant_verifier_id: z.string(),
  tenant_verified_attribute_id: z.string(),
  verification_date: z.string(),
  expiration_date: z.string().nullable(),
  extension_date: z.string().nullable(),
  delegation_id: z.string().nullable(),
  deleted: z.boolean().default(false),
});
export type TenantVerifiedAttributeVerifierSchema = z.infer<
  typeof TenantVerifiedAttributeVerifierSchema
>;
export type TenantVerifiedAttributeVerifierMapping = {
  [K in keyof TenantVerifiedAttributeVerifierSchema]: (
    record: TenantVerifiedAttributeVerifierSQL
  ) => TenantVerifiedAttributeVerifierSchema[K];
};

export const TenantVerifiedAttributeVerifierDeletingSchema = z.object({
  tenant_id: z.string(),
  tenant_verified_attribute_id: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantVerifiedAttributeVerifierDeletingSchema = z.infer<
  typeof TenantVerifiedAttributeVerifierDeletingSchema
>;
