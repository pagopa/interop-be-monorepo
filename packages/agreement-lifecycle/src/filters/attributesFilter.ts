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
import { P, match } from "ts-pattern";
import { isVerificationRevoked } from "../utils/verifiedAttributes.js";

export const filterVerifiedAttributes = (
  verifierId: TenantId,
  tenantAttributes: TenantAttribute[]
): VerifiedTenantAttribute[] => {
  const now = new Date();

  const isVerificationExpired = (verification: TenantVerifier): boolean =>
    match(verification)
      .with(
        { extensionDate: P.nonNullable, expirationDate: P.nonNullable },
        (v) => v.extensionDate <= now || v.expirationDate <= now
      )
      .with(
        { extensionDate: P.nonNullable, expirationDate: P.nullish },
        (v) => v.extensionDate <= now
      )
      .with(
        { expirationDate: P.nonNullable, extensionDate: P.nullish },
        (v) => v.expirationDate <= now
      )
      .with(
        { expirationDate: P.nullish, extensionDate: P.nullish },
        () => false
      )
      .exhaustive();

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
