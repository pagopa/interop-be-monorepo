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

export const TenantFeature = TenantFeatureCertifier; // It will be extended with other features, we will use this union to discriminate them

export type TenantFeature = z.infer<typeof TenantFeature>;

export const TenantCertifiedAttribute = z.object({
  assignmentTimestamp: z.coerce.date(),
  id: z.string().uuid(),
  type: z.literal("CertifiedAttribute"),
  revocationTimestamp: z.coerce.date().optional(),
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
  verifiedBy: z.array(TenantVerifier),
  revokedBy: z.array(TenantRevoker),
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

export const mailKind = {
  contactMail: "CONTACT_EMAIL",
} as const;
export const MailKind = z.enum([
  Object.values(mailKind)[0],
  ...Object.values(mailKind).slice(1),
]);
export type MailKind = z.infer<typeof MailKind>;

export const Mail = z.object({
  kind: MailKind,
  address: z.string(),
  description: z.string().optional(),
  createdAt: z.coerce.date(),
});
export type Mail = z.infer<typeof Mail>;

export const Tenant = z.object({
  id: z.string().uuid(),
  kind: TenantKind.optional(),
  selfcareId: z.string().optional(),
  externalId: ExternalId,
  features: z.array(TenantFeature),
  attributes: z.array(TenantAttribute),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  mails: z.array(Mail),
  name: z.string(),
});
export type Tenant = z.infer<typeof Tenant>;
