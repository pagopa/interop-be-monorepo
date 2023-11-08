
import z from "zod";

export const tenantKind = {
  PA: "PA",
  GSP: "GPS",
  PRIVATE: "PRIVATE",
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

export const TenantFeature = z.object({
  certifierId: z.string().uuid(),
});
export type TenantFeature = z.infer<typeof TenantFeature>;

export const tenantAttributeType = {
  CERTIFIED: "certified",
  DECLARED: "declared",
  VERIFIED: "verified",
} as const;

export const TenantAttributeType = z.enum([
  Object.values(tenantAttributeType)[0],
  ...Object.values(tenantAttributeType).slice(1),
]);
export type TenantAttributeType = z.infer<typeof TenantAttributeType>;

export const PersistentTenantRevoker = z.object({
  id: z.string().uuid(),
  verificationDate: z.date(),
  expirationDate: z.date().optional(),
  extensionDate: z.date().optional(),
  revocationDate: z.date(),
});
export type PersistentTenantRevoker = z.infer<typeof PersistentTenantRevoker>;

export const PersistentTenantVerifier = z.object({
  id: z.string().uuid(),
  verificationDate: z.date(),
  expirationDate: z.date().optional(),
  extensionDate: z.date().optional(),
});
export type PersistentTenantVerifier = z.infer<typeof PersistentTenantVerifier>;

export const CertifiedTenantAttribute = z.object({
  type: z.literal("certified"),
  id: z.string().uuid(),
  assignmentTimestamp: z.date(),
  revocationTimestamp: z.date().optional(),
});
export type CertifiedTenantAttribute = z.infer<typeof CertifiedTenantAttribute>;

export const DeclaredTenantAttribute = z.object({
  type: z.literal("declared"),
  id: z.string().uuid(),
  assignmentTimestamp: z.date(),
  revocationTimestamp: z.date().optional(),
});
export type DeclaredTenantAttribute = z.infer<typeof DeclaredTenantAttribute>;

export const VerifiedTenantAttribute = z.object({
  type: z.literal("verified"),
  id: z.string().uuid(),
  assignmentTimestamp: z.date(),
  verifiedBy: z.array(PersistentTenantVerifier),
  revokedBy: z.array(PersistentTenantRevoker),
});
export type VerifiedTenantAttribute = z.infer<typeof VerifiedTenantAttribute>;

export const TenantAttribute = z.discriminatedUnion("type", [
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  VerifiedTenantAttribute,
]);

export type TenantAttribute = z.infer<typeof TenantAttribute>;

export const tenantMailKind = {
  ContactEmail: "ContactEmail",
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
  createdAt: z.date(),
});

export const Tenant = z.object({
  id: z.string().uuid(),
  kind: TenantKind.optional(),
  selfcareId: z.string().optional(),
  externalId: ExternalId,
  features: z.array(TenantFeature),
  attributes: z.array(TenantAttribute),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  mails: z.array(TenantMail),
  name: z.string(),
});

export type Tenant = z.infer<typeof Tenant>;
