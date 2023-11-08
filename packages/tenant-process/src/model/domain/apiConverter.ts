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
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import * as api from "../generated/api.js";
import {
  ApiExternalId,
  ApiTenantFeature,
  ApiTenantKind,
  ApiTenantAttribute,
  ApiTenantVerifier,
  ApiTenantRevoker,
  ApiMail,
  ApiMailKind,
} from "./models.js";

export function tenantKindToApiTenantKind(input: TenantKind): ApiTenantKind {
  return match<TenantKind, ApiTenantKind>(input)
    .with(tenantKind.GSP, () => "GSP")
    .with(tenantKind.PA, () => "PA")
    .with(tenantKind.PRIVATE, () => "PRIVATE")
    .exhaustive();
}

export function tenantExternalIdToApiTenantExternalId(
  input: ExternalId
): ApiExternalId {
  return {
    origin: input.origin,
    value: input.value,
  };
}

export function tenantFeatureToApiTenantFeature(
  input: TenantFeature
): ApiTenantFeature {
  return match<TenantFeature, ApiTenantFeature>(input)
    .with({ type: "Certifier" }, (feature) => ({
      certifier: {
        certifierId: feature.certifierId,
      },
    }))
    .exhaustive();
}

export function tenantVerifierToApiTenantVerifier(
  verifier: TenantVerifier
): ApiTenantVerifier {
  return {
    id: verifier.id,
    verificationDate: verifier.verificationDate.toJSON(),
    expirationDate: verifier.expirationDate?.toJSON(),
    extensionDate: verifier.extensionDate?.toJSON(),
  };
}

export function tenantRevokerToApiTenantRevoker(
  revoker: TenantRevoker
): ApiTenantRevoker {
  return {
    id: revoker.id,
    verificationDate: revoker.verificationDate.toJSON(),
    expirationDate: revoker.expirationDate?.toJSON(),
    extensionDate: revoker.extensionDate?.toJSON(),
    revocationDate: revoker.revocationDate.toJSON(),
  };
}

export function tenantAttributeToApiTenantAttribute(
  input: TenantAttribute
): ApiTenantAttribute {
  return match<TenantAttribute, ApiTenantAttribute>(input)
    .with({ type: "certified" }, (attribute) => ({
      certified: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
        revocationTimestamp: attribute.revocationTimestamp?.toJSON(),
      },
    }))
    .with({ type: "verified" }, (attribute) => ({
      verified: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
        verifiedBy: attribute.verifiedBy.map(tenantVerifierToApiTenantVerifier),
        revokedBy: attribute.revokedBy.map(tenantRevokerToApiTenantRevoker),
      },
    }))
    .with({ type: "declared" }, (attribute) => ({
      declared: {
        id: attribute.id,
        assignmentTimestamp: attribute.assignmentTimestamp.toJSON(),
      },
    }))
    .exhaustive();
}

export function mailKindToApiMailKind(kind: TenantMailKind): ApiMailKind {
  return match<TenantMailKind, ApiMailKind>(kind)
    .with(tenantMailKind.ContactEmail, () => "CONTACT_EMAIL")
    .exhaustive();
}

export function mailToApiMail(mail: TenantMail): ApiMail {
  return {
    kind: mailKindToApiMailKind(mail.kind),
    address: mail.address,
    createdAt: mail.createdAt.toJSON(),
    description: mail.description ?? undefined,
  };
}

export const tenantToApiTenant = (
  tenant: Tenant
): z.infer<typeof api.schemas.Tenant> => ({
  id: tenant.id,
  kind: tenant.kind ? tenantKindToApiTenantKind(tenant.kind) : undefined,
  selfcareId: tenant.selfcareId ?? undefined,
  externalId: tenantExternalIdToApiTenantExternalId(tenant.externalId),
  features: tenant.features.map(tenantFeatureToApiTenantFeature),
  attributes: tenant.attributes.map(tenantAttributeToApiTenantAttribute),
  createdAt: tenant.createdAt.toJSON(),
  updatedAt: tenant.updatedAt?.toJSON(),
  mails: tenant.mails.map(mailToApiMail),
  name: tenant.name,
});
