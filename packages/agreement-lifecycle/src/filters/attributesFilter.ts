/* ========= FILTERS ========= */

import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  TenantId,
  VerifiedTenantAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { TenantWithOnlyAttributes } from "../models/models.js";

export const filterVerifiedAttributes = (
  producerId: TenantId,
  tenant: TenantWithOnlyAttributes
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
  tenant: TenantWithOnlyAttributes
): CertifiedTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.CERTIFIED && !att.revocationTimestamp
  ) as CertifiedTenantAttribute[];

export const filterDeclaredAttributes = (
  tenant: TenantWithOnlyAttributes
): DeclaredTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.DECLARED && !att.revocationTimestamp
  ) as DeclaredTenantAttribute[];
