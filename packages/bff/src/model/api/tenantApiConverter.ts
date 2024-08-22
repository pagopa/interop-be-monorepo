import {
  tenantApi,
  bffApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";
import { isDefined } from "pagopa-interop-commons";

export const toBffApiCompactOrganization = (
  input: tenantApi.Tenant
): bffApi.CompactOrganization => ({
  id: input.id,
  name: input.name,
});

export const toBffApiRequesterCertifiedAttributes = (
  input: tenantApi.CertifiedAttribute
): bffApi.RequesterCertifiedAttribute => ({
  tenantId: input.id,
  tenantName: input.name,
  attributeId: input.attributeId,
  attributeName: input.attributeName,
});

export type RegistryAttributesMap = Map<
  attributeRegistryApi.Attribute["id"],
  attributeRegistryApi.Attribute
>;

const toBffApiCertifiedTenantAttribute = (
  tenantAttribute: tenantApi.CertifiedTenantAttribute,
  registryAttributesMap: RegistryAttributesMap
): bffApi.CertifiedTenantAttribute | undefined => {
  const registryAttribute = registryAttributesMap.get(tenantAttribute.id);

  return registryAttribute
    ? {
        id: tenantAttribute.id,
        name: registryAttribute.name,
        description: registryAttribute.description,
        assignmentTimestamp: tenantAttribute.assignmentTimestamp,
        revocationTimestamp: tenantAttribute.revocationTimestamp,
      }
    : undefined;
};

const toBffApiDeclaredTenantAttribute = (
  tenantAttribute: tenantApi.DeclaredTenantAttribute,
  registryAttributesMap: RegistryAttributesMap
  // eslint-disable-next-line sonarjs/no-identical-functions
): bffApi.DeclaredTenantAttribute | undefined => {
  const registryAttribute = registryAttributesMap.get(tenantAttribute.id);

  return registryAttribute
    ? {
        id: tenantAttribute.id,
        name: registryAttribute.name,
        description: registryAttribute.description,
        assignmentTimestamp: tenantAttribute.assignmentTimestamp,
        revocationTimestamp: tenantAttribute.revocationTimestamp,
      }
    : undefined;
};

const toBffApiVerifiedTenantAttribute = (
  tenantAttribute: tenantApi.VerifiedTenantAttribute,
  registryAttributesMap: RegistryAttributesMap
): bffApi.VerifiedTenantAttribute | undefined => {
  const registryAttribute = registryAttributesMap.get(tenantAttribute.id);

  return registryAttribute
    ? {
        id: tenantAttribute.id,
        name: registryAttribute.name,
        description: registryAttribute.description,
        assignmentTimestamp: tenantAttribute.assignmentTimestamp,
        verifiedBy: tenantAttribute.verifiedBy,
        revokedBy: tenantAttribute.revokedBy,
      }
    : undefined;
};

export function toBffApiCertifiedTenantAttributes(
  certifiedAttributes: tenantApi.CertifiedTenantAttribute[],
  registryAttributesMap: RegistryAttributesMap
): bffApi.CertifiedTenantAttribute[] {
  return certifiedAttributes
    .map((tenantAttribute) =>
      toBffApiCertifiedTenantAttribute(tenantAttribute, registryAttributesMap)
    )
    .filter(isDefined);
}

export function toBffApiDeclaredTenantAttributes(
  declaredAttributes: tenantApi.DeclaredTenantAttribute[],
  registryAttributesMap: RegistryAttributesMap
): bffApi.DeclaredTenantAttribute[] {
  return declaredAttributes
    .map((tenantAttribute) =>
      toBffApiDeclaredTenantAttribute(tenantAttribute, registryAttributesMap)
    )
    .filter(isDefined);
}

export function toBffApiVerifiedTenantAttributes(
  verifiedAttributes: tenantApi.VerifiedTenantAttribute[],
  registryAttributesMap: RegistryAttributesMap
): bffApi.VerifiedTenantAttribute[] {
  return verifiedAttributes
    .map((tenantAttribute) =>
      toBffApiVerifiedTenantAttribute(tenantAttribute, registryAttributesMap)
    )
    .filter(isDefined);
}

function toBffApiTenantMail(
  tenantMails: tenantApi.Tenant["mails"]
): bffApi.Mail | undefined {
  const mail = tenantMails.find(
    (m) => m.kind === tenantApi.MailKind.Values.CONTACT_EMAIL
  );
  return mail
    ? {
        address: mail.address,
        description: mail.description,
      }
    : undefined;
}

export function toBffApiTenant(
  tenant: tenantApi.Tenant,
  certifiedAttributes: tenantApi.CertifiedTenantAttribute[],
  declaredAttributes: tenantApi.DeclaredTenantAttribute[],
  verifiedAttributes: tenantApi.VerifiedTenantAttribute[],
  registryAttributesMap: RegistryAttributesMap
): bffApi.Tenant {
  return {
    id: tenant.id,
    selfcareId: tenant.selfcareId,
    externalId: tenant.externalId,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    name: tenant.name,
    features: tenant.features,
    onboardedAt: tenant.onboardedAt,
    subUnitType: tenant.subUnitType,
    contactMail: toBffApiTenantMail(tenant.mails),
    attributes: {
      certified: toBffApiCertifiedTenantAttributes(
        certifiedAttributes,
        registryAttributesMap
      ),
      declared: toBffApiDeclaredTenantAttributes(
        declaredAttributes,
        registryAttributesMap
      ),
      verified: toBffApiVerifiedTenantAttributes(
        verifiedAttributes,
        registryAttributesMap
      ),
    },
  };
}
