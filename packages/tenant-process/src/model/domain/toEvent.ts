import { CreateEvent } from "pagopa-interop-commons";
import {
  TenantMail,
  TenantMailKind,
  Tenant,
  TenantAttribute,
  TenantAttributeV1,
  TenantFeature,
  TenantFeatureV1,
  TenantKind,
  TenantKindV1,
  TenantMailKindV1,
  TenantMailV1,
  TenantRevoker,
  TenantRevokerV1,
  TenantV1,
  TenantVerifier,
  TenantVerifierV1,
  tenantMailKind,
  tenantKind,
  TenantEvent,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export function toFeatureV1(feature: TenantFeature): TenantFeatureV1 {
  return match<TenantFeature, TenantFeatureV1>(feature)
    .with({ type: "Certifier" }, (feature) => ({
      sealedValue: {
        oneofKind: "certifier",
        certifier: {
          certifierId: feature.certifierId,
        },
      },
    }))
    .exhaustive();
}

export function toTenantVerifierV1(verifier: TenantVerifier): TenantVerifierV1 {
  return {
    id: verifier.id,
    verificationDate: BigInt(verifier.verificationDate.getTime()),
    expirationDate: verifier.expirationDate
      ? BigInt(verifier.expirationDate?.getTime())
      : undefined,
    extensionDate: verifier.extensionDate
      ? BigInt(verifier.extensionDate?.getTime())
      : undefined,
  };
}

export function toTenantRevokerV1(revoker: TenantRevoker): TenantRevokerV1 {
  return {
    id: revoker.id,
    verificationDate: BigInt(revoker.verificationDate.getTime()),
    expirationDate: revoker.expirationDate
      ? BigInt(revoker.expirationDate?.getTime())
      : undefined,
    extensionDate: revoker.extensionDate
      ? BigInt(revoker.extensionDate?.getTime())
      : undefined,
    revocationDate: BigInt(revoker.revocationDate.getTime()),
  };
}

export function toAttributeV1(input: TenantAttribute): TenantAttributeV1 {
  return match<TenantAttribute, TenantAttributeV1>(input)
    .with({ type: "certified" }, (attribute) => ({
      sealedValue: {
        oneofKind: "certifiedAttribute",
        certifiedAttribute: {
          id: attribute.id,
          assignmentTimestamp: BigInt(attribute.assignmentTimestamp.getTime()),
          revocationTimestamp: attribute.revocationTimestamp
            ? BigInt(attribute.revocationTimestamp?.getTime())
            : undefined,
        },
      },
    }))
    .with({ type: "verified" }, (attribute) => ({
      sealedValue: {
        oneofKind: "verifiedAttribute",
        verifiedAttribute: {
          id: attribute.id,
          assignmentTimestamp: BigInt(attribute.assignmentTimestamp.getTime()),
          verifiedBy: attribute.verifiedBy.map(toTenantVerifierV1),
          revokedBy: attribute.revokedBy.map(toTenantRevokerV1),
        },
      },
    }))
    .with({ type: "declared" }, (attribute) => ({
      sealedValue: {
        oneofKind: "declaredAttribute",
        declaredAttribute: {
          id: attribute.id,
          assignmentTimestamp: BigInt(attribute.assignmentTimestamp.getTime()),
        },
      },
    }))
    .exhaustive();
}

export function toTenantMailV1(mail: TenantMail): TenantMailV1 {
  return {
    kind: toTenantMailKindV1(mail.kind),
    address: mail.address,
    createdAt: BigInt(mail.createdAt.getTime()),
    description: mail.description ?? undefined,
  };
}

export function toTenantMailKindV1(kind: TenantMailKind): TenantMailKindV1 {
  return match(kind)
    .with(tenantMailKind.ContactEmail, () => TenantMailKindV1.CONTACT_EMAIL)
    .exhaustive();
}

export function toTenantKindV1(input: TenantKind): TenantKindV1 {
  return match<TenantKind, TenantKindV1>(input)
    .with(tenantKind.GSP, () => TenantKindV1.GSP)
    .with(tenantKind.PA, () => TenantKindV1.PA)
    .with(tenantKind.PRIVATE, () => TenantKindV1.PRIVATE)
    .exhaustive();
}

export const toTenantV1 = (tenant: Tenant): TenantV1 => ({
  ...tenant,
  features: tenant.features.map(toFeatureV1),
  attributes: tenant.attributes.map(toAttributeV1),
  createdAt: BigInt(tenant.createdAt.getTime()),
  updatedAt: tenant.updatedAt ? BigInt(tenant.updatedAt.getTime()) : undefined,
  mails: tenant.mails.map(toTenantMailV1),
  kind: tenant.kind ? toTenantKindV1(tenant.kind) : undefined,
});

export const toCreateEventTenantAdded = (
  tenant: Tenant
): CreateEvent<TenantEvent> => ({
  streamId: tenant.id,
  version: 0,
  event: {
    type: "TenantCreated",
    data: { tenant: toTenantV1(tenant) },
  },
});

export const toCreateEventTenantUpdated = (
  streamId: string,
  version: number,
  updatedTenant: Tenant
): CreateEvent<TenantEvent> => ({
  streamId,
  version,
  event: {
    type: "TenantUpdated",
    data: {
      tenant: toTenantV1(updatedTenant),
    },
  },
});
