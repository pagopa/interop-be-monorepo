import {
  ExternalId,
  Tenant,
  TenantKind,
  tenantKind,
  TenantAttribute,
  TenantVerifier,
  TenantRevoker,
  TenantMail,
  TenantMailKind,
  tenantMailKind,
  TenantFeature,
  tenantAttributeType,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import {
  ApiExternalId,
  ApiTenantFeature,
  ApiTenantKind,
  ApiTenantAttribute,
  ApiTenantVerifier,
  ApiTenantRevoker,
  ApiMail,
  ApiMailKind,
  ApiTenant,
} from "./models.js";

export function toApiTenantKind(input: TenantKind): ApiTenantKind {
  return match<TenantKind, ApiTenantKind>(input)
    .with(tenantKind.GSP, () => "GSP")
    .with(tenantKind.PA, () => "PA")
    .with(tenantKind.PRIVATE, () => "PRIVATE")
    .exhaustive();
}

export function toApiTenantExternalId(input: ExternalId): ApiExternalId {
  return {
    origin: input.origin,
    value: input.value,
  };
}

export function toApiTenantFeature(input: TenantFeature): ApiTenantFeature {
  return match<TenantFeature, ApiTenantFeature>(input)
    .with({ type: "PersistentCertifier" }, (feature) => ({
      certifier: {
        certifierId: feature.certifierId,
      },
    }))
    .exhaustive();
}

export function toApiTenantVerifier(
  verifier: TenantVerifier
): ApiTenantVerifier {
  return {
    id: verifier.id,
    verificationDate: verifier.verificationDate.toJSON(),
    expirationDate: verifier.expirationDate?.toJSON(),
    extensionDate: verifier.extensionDate?.toJSON(),
  };
}

export function toApiTenantRevoker(revoker: TenantRevoker): ApiTenantRevoker {
  return {
    id: revoker.id,
    verificationDate: revoker.verificationDate.toJSON(),
    expirationDate: revoker.expirationDate?.toJSON(),
    extensionDate: revoker.extensionDate?.toJSON(),
    revocationDate: revoker.revocationDate.toJSON(),
  };
}

export function toApiTenantAttribute(
  input: TenantAttribute
): ApiTenantAttribute {
  return match<TenantAttribute, ApiTenantAttribute>(input)
    .with({ type: tenantAttributeType.CERTIFIED }, (attribute) => ({
      certified: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
        revocationTimestamp: attribute.revocationTimestamp?.toJSON(),
      },
    }))
    .with({ type: tenantAttributeType.VERIFIED }, (attribute) => ({
      verified: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
        verifiedBy: attribute.verifiedBy.map(toApiTenantVerifier),
        revokedBy: attribute.revokedBy.map(toApiTenantRevoker),
      },
    }))
    .with({ type: tenantAttributeType.DECLARED }, (attribute) => ({
      declared: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
      },
    }))
    .exhaustive();
}

export function toApiMailKind(kind: TenantMailKind): ApiMailKind {
  return match<TenantMailKind, ApiMailKind>(kind)
    .with(tenantMailKind.ContactEmail, () => "CONTACT_EMAIL")
    .with(tenantMailKind.DigitalAddress, () => "DIGITAL_ADDRESS")
    .exhaustive();
}

export function toApiMail(mail: TenantMail): ApiMail {
  return {
    kind: toApiMailKind(mail.kind),
    address: mail.address,
    createdAt: mail.createdAt.toJSON(),
    description: mail.description ?? undefined,
  };
}

export function toApiTenant(tenant: Tenant): ApiTenant {
  return {
    id: tenant.id,
    kind: tenant.kind ? toApiTenantKind(tenant.kind) : undefined,
    selfcareId: tenant.selfcareId ?? undefined,
    externalId: toApiTenantExternalId(tenant.externalId),
    features: tenant.features.map(toApiTenantFeature),
    attributes: tenant.attributes.map(toApiTenantAttribute),
    createdAt: tenant.createdAt.toJSON(),
    updatedAt: tenant.updatedAt?.toJSON(),
    mails: tenant.mails.map(toApiMail),
    name: tenant.name,
  };
}
