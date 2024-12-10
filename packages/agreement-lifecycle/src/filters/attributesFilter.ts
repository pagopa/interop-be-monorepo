/* ========= FILTERS ========= */

import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  TenantAttribute,
  TenantId,
  TenantVerifier,
  VerifiedTenantAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { isVerificationRevoked } from "../utils/verifiedAttributes.js";

export const filterVerifiedAttributes = (
  verifierId: TenantId,
  tenantAttributes: TenantAttribute[]
): VerifiedTenantAttribute[] => {
  const now = new Date();

  const isVerificationExpired = (verification: TenantVerifier): boolean => {
    if (verification.extensionDate) {
      return verification.extensionDate <= now;
    }

    if (verification.expirationDate) {
      return verification.expirationDate <= now;
    }

    return false;
  };

  return tenantAttributes.filter(
    (att) =>
      att.type === tenantAttributeType.VERIFIED &&
      att.verifiedBy.some(
        (v) =>
          v.id === verifierId &&
          !isVerificationRevoked(verifierId, att) &&
          !isVerificationExpired(v)
      )
  ) as VerifiedTenantAttribute[];
};

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
