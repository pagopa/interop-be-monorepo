import { z } from "zod";

export const persistentTenantKind = {
  pa: "PA",
  gsp: "GSP",
  private: "PRIVATE",
} as const;
export const PersistentTenantKind = z.enum([
  Object.values(persistentTenantKind)[0],
  ...Object.values(persistentTenantKind).slice(1),
]);
export type PersistentTenantKind = z.infer<typeof PersistentTenantKind>;

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

export const PersistentTenantCertifiedAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: z.string().uuid(),
  type: z.literal("PersistentCertifiedAttribute"),
});
export type PersistentTenantCertifiedAttribute = z.infer<
  typeof PersistentTenantCertifiedAttribute
>;

export const PersistentTenantVerifier = z.object({
  id: z.string(),
  verificationDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  extensionDate: z.coerce.date().optional(),
});
export type PersistentTenantVerifier = z.infer<typeof PersistentTenantVerifier>;

export const PersistentTenantRevoker = z.object({
  expirationDate: z.coerce.date().optional(),
  extensionDate: z.coerce.date().optional(),
  id: z.string().uuid(),
  revocationDate: z.coerce.date(),
  verificationDate: z.coerce.date(),
});
export type PersistentTenantRevoker = z.infer<typeof PersistentTenantRevoker>;

export const PersistentTenantVerifierAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: z.string().uuid(),
  type: z.literal("PersistentVerifiedAttribute"),
  verifiedBy: z.array(PersistentTenantVerifier).optional(),
  revokedBy: z.array(PersistentTenantRevoker).optional(),
});
export type PersistentTenantVerifierAttribute = z.infer<
  typeof PersistentTenantVerifierAttribute
>;

export const PersistentTenantDeclaredAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: z.string().uuid(),
  type: z.literal("PersistentDeclaredAttribute"),
});
export type PersistentTenantDeclaredAttribute = z.infer<
  typeof PersistentTenantDeclaredAttribute
>;

export const PersistentTenantAttribute = z.union([
  PersistentTenantCertifiedAttribute,
  PersistentTenantVerifierAttribute,
  PersistentTenantDeclaredAttribute,
]);
export type PersistentTenantAttribute = z.infer<
  typeof PersistentTenantAttribute
>;

export const persistentTenantMailKind = {
  contactMail: "CONTACT_MAIL",
} as const;
export const PersistentTenantMailKind = z.enum([
  Object.values(persistentTenantMailKind)[0],
  ...Object.values(persistentTenantMailKind).slice(1),
]);
export type PersistentTenantMailKind = z.infer<typeof PersistentTenantMailKind>;

export const PersistentTenantMail = z.object({
  kind: PersistentTenantMailKind,
  address: z.string(),
  description: z.string().optional(),
  createdAt: z.coerce.date(),
});
export type PersistentTenantMail = z.infer<typeof PersistentTenantMail>;

export const PersistentTenant = z.object({
  id: z.string().uuid(),
  kind: PersistentTenantKind.optional(),
  selfcareId: z.string().optional(),
  externalId: PersistentExternalId,
  features: z.array(PersistentTenantFeature),
  attributes: z.array(PersistentTenantAttribute),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  mails: z.array(PersistentTenantMail),
  name: z.string(),
});
export type PersistentTenant = z.infer<typeof PersistentTenant>;
