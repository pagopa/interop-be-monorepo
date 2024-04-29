/*
  This model is required for retro-compatibility with the read model in production:
  the Scala services read/write ISO strings for all date fields.

  After all services will be migrated to TS, we should remove this model
  and the corresponding adapters, as tracked in https://pagopa.atlassian.net/browse/IMN-367
*/

import { z } from "zod";
import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Tenant,
  TenantMail,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
} from "../tenant/tenant.js";

export const CertifiedTenantAttributeReadModel =
  CertifiedTenantAttribute.extend({
    assignmentTimestamp: z.string().datetime(),
    revocationTimestamp: z.string().datetime().optional(),
  });

export const TenantVerifierReadModel = TenantVerifier.extend({
  verificationDate: z.string().datetime(),
  expirationDate: z.string().datetime().optional(),
  extensionDate: z.string().datetime().optional(),
});

export const TenantRevokerReadModel = TenantRevoker.extend({
  expirationDate: z.string().datetime().optional(),
  extensionDate: z.string().datetime().optional(),
  revocationDate: z.string().datetime(),
  verificationDate: z.string().datetime(),
});

export const VerifiedTenantAttributeReadModel = VerifiedTenantAttribute.extend({
  assignmentTimestamp: z.string().datetime(),
  verifiedBy: z.array(TenantVerifierReadModel),
  revokedBy: z.array(TenantRevokerReadModel),
});

export const DeclaredTenantAttributeReadModel = DeclaredTenantAttribute.extend({
  assignmentTimestamp: z.string().datetime(),
  revocationTimestamp: z.string().datetime().optional(),
});

export const TenantAttributeReadModel = z.discriminatedUnion("type", [
  CertifiedTenantAttributeReadModel,
  VerifiedTenantAttributeReadModel,
  DeclaredTenantAttributeReadModel,
]);

export const TenantMailReadModel = TenantMail.extend({
  createdAt: z.string().datetime(),
});

export const TenantReadModel = Tenant.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  onboardedAt: z.string().datetime().optional(),
  attributes: z.array(TenantAttributeReadModel),
  mails: z.array(TenantMailReadModel),
});

export type TenantReadModel = z.infer<typeof TenantReadModel>;
export type CertifiedTenantAttributeReadModel = z.infer<
  typeof CertifiedTenantAttributeReadModel
>;
export type TenantVerifierReadModel = z.infer<typeof TenantVerifierReadModel>;
export type TenantRevokerReadModel = z.infer<typeof TenantRevokerReadModel>;
export type VerifiedTenantAttributeReadModel = z.infer<
  typeof VerifiedTenantAttributeReadModel
>;
export type DeclaredTenantAttributeReadModel = z.infer<
  typeof DeclaredTenantAttributeReadModel
>;
export type TenantAttributeReadModel = z.infer<typeof TenantAttributeReadModel>;
export type TenantMailReadModel = z.infer<typeof TenantMailReadModel>;
