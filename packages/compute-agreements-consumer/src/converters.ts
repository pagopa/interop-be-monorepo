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

function toApiCompactTenantCertifiedDeclaredAttribute(
  attr: CertifiedTenantAttribute
): agreementApi.CertifiedTenantAttribute;
function toApiCompactTenantCertifiedDeclaredAttribute(
  attr: DeclaredTenantAttribute
): agreementApi.DeclaredTenantAttribute;
function toApiCompactTenantCertifiedDeclaredAttribute(
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
      toApiCompactTenantCertifiedDeclaredAttribute
    )
    .with(
      { type: tenantAttributeType.DECLARED },
      toApiCompactTenantCertifiedDeclaredAttribute
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
