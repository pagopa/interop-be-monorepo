import { z } from "zod";

export const PersistentTenantRevoker = z.object({
  id: z.string().uuid(),
  verificationDate: z.string().pipe(z.coerce.date()),
  revocationDate: z.string().pipe(z.coerce.date()),
  expirationDate: z.string().pipe(z.coerce.date()).optional(),
  extensionDate: z.string().pipe(z.coerce.date()).optional(),
});
export type PersistentTenantRevoker = z.infer<typeof PersistentTenantRevoker>;

export const PersistentTenantVerifier = z.object({
  id: z.string().uuid(),
  verificationDate: z.string().pipe(z.coerce.date()),
  expirationDate: z.string().pipe(z.coerce.date()).optional(),
  extensionDate: z.string().pipe(z.coerce.date()).optional(),
});
export type PersistentTenantVerifier = z.infer<typeof PersistentTenantVerifier>;

export const PersistentCertifiedAttribute = z.object({
  id: z.string().uuid(),
  type: z.literal("PersistentCertifiedAttribute"),
  assignmentTimestamp: z.string().pipe(z.coerce.date()),
  revocationTimestamp: z.string().pipe(z.coerce.date()).optional(),
});
export type PersistentCertifiedAttribute = z.infer<
  typeof PersistentCertifiedAttribute
>;

export const PersistentDeclaredAttribute = z.object({
  id: z.string().uuid(),
  type: z.literal("PersistentDeclaredAttribute"),
  assignmentTimestamp: z.string().pipe(z.coerce.date()),
  revocationTimestamp: z.string().pipe(z.coerce.date()).optional(),
});
export type PersistentDeclaredAttribute = z.infer<
  typeof PersistentDeclaredAttribute
>;

export const PersistentVerifiedAttribute = z.object({
  id: z.string().uuid(),
  type: z.literal("PersistentVerifiedAttribute"),
  assignmentTimestamp: z.string().pipe(z.coerce.date()),
  verifiedBy: z.array(PersistentTenantVerifier),
  revokedBy: z.array(PersistentTenantRevoker),
});
export type PersistentVerifiedAttribute = z.infer<
  typeof PersistentVerifiedAttribute
>;

export const PersistentTenantAttribute = PersistentCertifiedAttribute.or(
  PersistentVerifiedAttribute
).or(PersistentDeclaredAttribute);

export type PersistentTenantAttribute = z.infer<
  typeof PersistentTenantAttribute
>;

export const PersistentExternalId = z.object({
  origin: z.string(),
  value: z.string(),
});

export type PersistentExternalId = z.infer<typeof PersistentExternalId>;

export const PersistentTenantFeatureCertifier = z.object({
  type: z.literal("PersistentCertifier"),
  certifierId: z.string(),
});

export type PersistentTenantFeatureCertifier = z.infer<
  typeof PersistentTenantFeatureCertifier
>;

export const PersistentTenantFeatureOther = z.object({
  type: z.string(),
});

export type PersistentTenantFeatureOther = z.infer<
  typeof PersistentTenantFeatureOther
>;

export const PersistentTenantFeature = z.union([
  PersistentTenantFeatureCertifier,
  PersistentTenantFeatureOther,
]);

export type PersistentTenantFeature = z.infer<typeof PersistentTenantFeature>;

export const PersistentTenant = z.object({
  id: z.string(),
  externalId: PersistentExternalId,
  attributes: z.array(PersistentTenantAttribute),
  features: z.array(PersistentTenantFeatureCertifier),
});
export type PersistentTenant = z.infer<typeof PersistentTenant>;
