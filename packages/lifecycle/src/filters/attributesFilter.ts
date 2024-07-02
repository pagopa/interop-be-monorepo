/* ========= FILTERS ========= */

import {
  CertifiedTenantAttribute,
  CompactTenant,
  DeclaredTenantAttribute,
  Tenant,
  TenantId,
  VerifiedTenantAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";

export const filterVerifiedAttributes = (
  producerId: TenantId,
  tenant: Tenant | CompactTenant
): VerifiedTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.VERIFIED &&
      att.verifiedBy.find(
        (v) =>
          v.id === producerId &&
          (!v.extensionDate || v.extensionDate > new Date())
      )
  ) as VerifiedTenantAttribute[];

export const filterCertifiedAttributes = (
  tenant: Tenant | CompactTenant
): CertifiedTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.CERTIFIED && !att.revocationTimestamp
  ) as CertifiedTenantAttribute[];

export const filterDeclaredAttributes = (
  tenant: Tenant | CompactTenant
): DeclaredTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.DECLARED && !att.revocationTimestamp
  ) as DeclaredTenantAttribute[];
