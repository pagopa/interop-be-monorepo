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
  producerId: TenantId,
  tenantAttributes: TenantAttribute[]
): VerifiedTenantAttribute[] =>
  tenantAttributes.filter(
    (att) =>
      att.type === tenantAttributeType.VERIFIED &&
      att.verifiedBy.find(
        (v) =>
          v.id === producerId &&
          (!v.extensionDate || v.extensionDate > new Date())
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
