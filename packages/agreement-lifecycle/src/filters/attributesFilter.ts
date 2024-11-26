/* ========= FILTERS ========= */

import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  TenantAttribute,
  TenantId,
  VerifiedTenantAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";

export const filterVerifiedAttributes = (
  verifiedId: TenantId,
  tenantAttributes: TenantAttribute[]
): VerifiedTenantAttribute[] =>
  tenantAttributes.filter(
    (att) =>
      att.type === tenantAttributeType.VERIFIED &&
      att.verifiedBy.find(
        (v) =>
          v.id === verifiedId &&
          !att.revokedBy.find((revocation) => revocation.id === v.id) &&
          ((!v.extensionDate && !v.expirationDate) ||
            (v.extensionDate &&
              v.expirationDate &&
              v.extensionDate > new Date() &&
              v.expirationDate > new Date()) ||
            (v.extensionDate
              ? v.extensionDate > new Date()
              : v.expirationDate
              ? v.expirationDate > new Date()
              : false))
      )
  ) as VerifiedTenantAttribute[];

export const filterCertifiedAttributes = (
  tenantAttributes: TenantAttribute[]
): CertifiedTenantAttribute[] =>
  tenantAttributes.filter(
    (att) =>
      att.type === tenantAttributeType.CERTIFIED && !att.revocationTimestamp
  ) as CertifiedTenantAttribute[];

export const filterDeclaredAttributes = (
  tenantAttributes: TenantAttribute[]
): DeclaredTenantAttribute[] =>
  tenantAttributes.filter(
    (att) =>
      att.type === tenantAttributeType.DECLARED && !att.revocationTimestamp
  ) as DeclaredTenantAttribute[];
