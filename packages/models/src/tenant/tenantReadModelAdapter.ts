import { match } from "ts-pattern";
import {
  TenantAttributeReadModel,
  TenantMailReadModel,
  TenantReadModel,
  TenantRevokerReadModel,
  TenantVerifierReadModel,
  VerifiedTenantAttributeReadModel,
} from "../index.js";
import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Tenant,
  TenantAttribute,
  TenantMail,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  tenantAttributeType,
} from "./tenant.js";

export const toReadModelTenant = (tenant: Tenant): TenantReadModel => ({
  ...tenant,
  attributes: tenant.attributes.map(toReadModelTenantAttribute),
  createdAt: tenant.createdAt.toISOString(),
  updatedAt: tenant.updatedAt?.toISOString(),
  onboardedAt: tenant.onboardedAt?.toISOString(),
  mails: tenant.mails.map(toReadModelTenantMail),
});

export const toReadModelTenantMail = (
  mail: TenantMail
): TenantMailReadModel => ({
  ...mail,
  createdAt: mail.createdAt.toISOString(),
});

export const toReadModelCertifiedTenantAttribute = (
  certifiedTenantAttribute: CertifiedTenantAttribute
): TenantAttributeReadModel => ({
  ...certifiedTenantAttribute,
  assignmentTimestamp:
    certifiedTenantAttribute.assignmentTimestamp.toISOString(),
  revocationTimestamp:
    certifiedTenantAttribute.revocationTimestamp?.toISOString(),
});

export const toReadModelDeclaredTenantAttribute = (
  declaredTenantAttribute: DeclaredTenantAttribute
): TenantAttributeReadModel => ({
  ...declaredTenantAttribute,
  assignmentTimestamp:
    declaredTenantAttribute.assignmentTimestamp.toISOString(),
  revocationTimestamp:
    declaredTenantAttribute.revocationTimestamp?.toISOString(),
});

export const toReadModelTenantVerifier = (
  tenantVerifier: TenantVerifier
): TenantVerifierReadModel => ({
  ...tenantVerifier,
  verificationDate: tenantVerifier.verificationDate.toISOString(),
  expirationDate: tenantVerifier.expirationDate?.toISOString(),
  extensionDate: tenantVerifier.extensionDate?.toISOString(),
});

export const toReadModelTenantRevoker = (
  tenantRevoker: TenantRevoker
): TenantRevokerReadModel => ({
  ...tenantRevoker,
  verificationDate: tenantRevoker.verificationDate.toISOString(),
  revocationDate: tenantRevoker.revocationDate.toISOString(),
  expirationDate: tenantRevoker.expirationDate?.toISOString(),
  extensionDate: tenantRevoker.extensionDate?.toISOString(),
});

export const toReadModelVerifiedTenantAttribute = (
  verifiedTenantAttribute: VerifiedTenantAttribute
): VerifiedTenantAttributeReadModel => ({
  ...verifiedTenantAttribute,
  assignmentTimestamp:
    verifiedTenantAttribute.assignmentTimestamp.toISOString(),
  verifiedBy: verifiedTenantAttribute.verifiedBy.map(toReadModelTenantVerifier),
  revokedBy: verifiedTenantAttribute.revokedBy.map(toReadModelTenantRevoker),
});

export const toReadModelTenantAttribute = (
  tenantAttribute: TenantAttribute
): TenantAttributeReadModel =>
  match<TenantAttribute, TenantAttributeReadModel>(tenantAttribute)
    .with(
      {
        type: tenantAttributeType.CERTIFIED,
      },
      (attribute) => toReadModelCertifiedTenantAttribute(attribute)
    )
    .with(
      {
        type: tenantAttributeType.VERIFIED,
      },
      (attribute) => toReadModelVerifiedTenantAttribute(attribute)
    )
    .with(
      {
        type: tenantAttributeType.DECLARED,
      },
      (attribute) => toReadModelDeclaredTenantAttribute(attribute)
    )
    .exhaustive();
