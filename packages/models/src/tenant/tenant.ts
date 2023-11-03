import { z } from "zod";

export const tenantKind = {
  pa: "PA",
  gsp: "GSP",
  private: "PRIVATE",
} as const;
export const TenantKind = z.enum([
  Object.values(tenantKind)[0],
  ...Object.values(tenantKind).slice(1),
]);
export type TenantKind = z.infer<typeof TenantKind>;

export const ExternalId = z.object({
  origin: z.string(),
  value: z.string(),
});
export type ExternalId = z.infer<typeof ExternalId>;

export const TenantFeatureCertifier = z.object({
  type: z.literal("Certifier"),
  certifierId: z.string(),
});
export type TenantFeatureCertifier = z.infer<typeof TenantFeatureCertifier>;

export const TenantFeatureOther = z.object({
  type: z.string(),
});
export type TenantFeatureOther = z.infer<typeof TenantFeatureOther>;

export const TenantFeature = z.union([
  TenantFeatureCertifier,
  TenantFeatureOther,
]);
export type TenantFeature = z.infer<typeof TenantFeature>;

export const TenantCertifiedAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: z.string().uuid(),
  type: z.literal("CertifiedAttribute"),
});
export type TenantCertifiedAttribute = z.infer<typeof TenantCertifiedAttribute>;

export const TenantVerifier = z.object({
  id: z.string(),
  verificationDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  extensionDate: z.coerce.date().optional(),
});
export type TenantVerifier = z.infer<typeof TenantVerifier>;

export const TenantRevoker = z.object({
  expirationDate: z.coerce.date().optional(),
  extensionDate: z.coerce.date().optional(),
  id: z.string().uuid(),
  revocationDate: z.coerce.date(),
  verificationDate: z.coerce.date(),
});
export type TenantRevoker = z.infer<typeof TenantRevoker>;

export const TenantVerifierAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: z.string().uuid(),
  type: z.literal("VerifiedAttribute"),
  verifiedBy: z.array(TenantVerifier).optional(),
  revokedBy: z.array(TenantRevoker).optional(),
});
export type TenantVerifierAttribute = z.infer<typeof TenantVerifierAttribute>;

export const TenantDeclaredAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: z.string().uuid(),
  type: z.literal("DeclaredAttribute"),
});
export type TenantDeclaredAttribute = z.infer<typeof TenantDeclaredAttribute>;

export const TenantAttribute = z.union([
  TenantCertifiedAttribute,
  TenantVerifierAttribute,
  TenantDeclaredAttribute,
]);
export type TenantAttribute = z.infer<typeof TenantAttribute>;

export const tenantMailKind = {
  contactMail: "CONTACT_MAIL",
} as const;
export const TenantMailKind = z.enum([
  Object.values(tenantMailKind)[0],
  ...Object.values(tenantMailKind).slice(1),
]);
export type TenantMailKind = z.infer<typeof TenantMailKind>;

export const TenantMail = z.object({
  kind: TenantMailKind,
  address: z.string(),
  description: z.string().optional(),
  createdAt: z.coerce.date(),
});
export type TenantMail = z.infer<typeof TenantMail>;

export const Tenant = z.object({
  id: z.string().uuid(),
  kind: TenantKind.optional(),
  selfcareId: z.string().optional(),
  externalId: ExternalId,
  features: z.array(TenantFeature),
  attributes: z.array(TenantAttribute),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  mails: z.array(TenantMail),
  name: z.string(),
});
export type Tenant = z.infer<typeof Tenant>;
