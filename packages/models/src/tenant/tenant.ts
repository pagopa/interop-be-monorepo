import { z } from "zod";

export const PersistentTenantKind = z.enum(["PA", "GSP", "PRIVATE"]);
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

export const PersistentTenantVerified = z.object({
  id: z.string().uuid(),
  verificationDate: z.coerce.date(),
});
export type PersistentTenantVerified = z.infer<typeof PersistentTenantVerified>;

export const PersistenTenantRevoker = z.object({
  expirationDate: z.coerce.date().optional(),
  extensionDate: z.coerce.date().optional(),
  id: z.string().uuid(),
  revocationDate: z.coerce.date(),
  verificationDate: z.coerce.date(),
});
export type PersistenTenantRevoker = z.infer<typeof PersistenTenantRevoker>;

export const PersistentTenantVerifiedAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: z.string().uuid(),
  type: z.literal("PersistentVerifiedAttribute"),
  verifiedBy: z.array(PersistentTenantVerified).optional(),
  revokedBy: z.array(PersistenTenantRevoker).optional(),
});
export type PersistentTenantVerifiedAttribute = z.infer<
  typeof PersistentTenantVerifiedAttribute
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
  PersistentTenantVerifiedAttribute,
  PersistentTenantDeclaredAttribute,
]);
export type PersistentTenantAttribute = z.infer<
  typeof PersistentTenantAttribute
>;

export const PersistentTenantMailKind = z.enum(["CONTACT_EMAIL"]);
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
