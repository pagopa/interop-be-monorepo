import { match } from "ts-pattern";
import { agreementApi } from "pagopa-interop-api-clients";
import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Tenant,
  TenantAttribute,
  tenantAttributeType,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";

function toApiCompactTenantCertifiedVerifiedAttribute(
  attr: CertifiedTenantAttribute
): agreementApi.CertifiedTenantAttribute;
function toApiCompactTenantCertifiedVerifiedAttribute(
  attr: DeclaredTenantAttribute
): agreementApi.DeclaredTenantAttribute;
function toApiCompactTenantCertifiedVerifiedAttribute(
  attr: CertifiedTenantAttribute | DeclaredTenantAttribute
):
  | agreementApi.CertifiedTenantAttribute
  | agreementApi.DeclaredTenantAttribute {
  return {
    id: attr.id,
    assignmentTimestamp: attr.assignmentTimestamp.toISOString(),
    revocationTimestamp: attr.revocationTimestamp?.toISOString(),
  };
}

function toApiCompactTenantVerifiedAttribute(
  attr: VerifiedTenantAttribute
): agreementApi.VerifiedTenantAttribute {
  return {
    id: attr.id,
    assignmentTimestamp: attr.assignmentTimestamp.toISOString(),
    verifiedBy: attr.verifiedBy.map((v) => ({
      id: v.id,
      extensionDate: v.extensionDate?.toISOString(),
      verificationDate: v.verificationDate?.toISOString(),
      expirationDate: v.expirationDate?.toISOString(),
    })),
    revokedBy: attr.revokedBy.map((v) => ({
      id: v.id,
      extensionDate: v.extensionDate?.toISOString(),
      verificationDate: v.verificationDate.toISOString(),
      revocationDate: v.verificationDate.toISOString(),
      expirationDate: v.expirationDate?.toISOString(),
    })),
  };
}

function toCompactTenantAttribute(
  attribute: TenantAttribute
): agreementApi.TenantAttribute {
  return match(attribute)
    .returnType<agreementApi.TenantAttribute>()
    .with(
      { type: tenantAttributeType.CERTIFIED },
      toApiCompactTenantCertifiedVerifiedAttribute
    )
    .with(
      { type: tenantAttributeType.DECLARED },
      toApiCompactTenantCertifiedVerifiedAttribute
    )
    .with(
      { type: tenantAttributeType.VERIFIED },
      toApiCompactTenantVerifiedAttribute
    );
}

export function toApiCompactTenant(tenant: Tenant): agreementApi.CompactTenant {
  return {
    id: tenant.id,
    attributes: tenant.attributes.map(toCompactTenantAttribute),
  };
}
