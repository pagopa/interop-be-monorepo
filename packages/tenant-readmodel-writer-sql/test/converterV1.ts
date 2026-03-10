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
  tenantAttributeType,
  TenantUnitTypeV1,
  tenantUnitType,
  TenantUnitType,
  dateToBigInt,
  tenantFeatureType,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

function toFeatureV1(feature: TenantFeature): TenantFeatureV1 {
  return match<TenantFeature, TenantFeatureV1>(feature)
    .with({ type: tenantFeatureType.persistentCertifier }, (feature) => ({
      sealedValue: {
        oneofKind: "certifier",
        certifier: {
          certifierId: feature.certifierId,
        },
      },
    }))
    .otherwise(() => {
      throw new Error("Unsupported tenant feature");
    });
}

function toTenantVerifierV1(verifier: TenantVerifier): TenantVerifierV1 {
  return {
    id: verifier.id,
    verificationDate: dateToBigInt(verifier.verificationDate),
    expirationDate: dateToBigInt(verifier.expirationDate),
    extensionDate: dateToBigInt(verifier.extensionDate),
  };
}

function toTenantRevokerV1(revoker: TenantRevoker): TenantRevokerV1 {
  return {
    id: revoker.id,
    verificationDate: dateToBigInt(revoker.verificationDate),
    expirationDate: dateToBigInt(revoker.expirationDate),
    extensionDate: dateToBigInt(revoker.extensionDate),
    revocationDate: dateToBigInt(revoker.revocationDate),
  };
}

function toAttributeV1(input: TenantAttribute): TenantAttributeV1 {
  return match<TenantAttribute, TenantAttributeV1>(input)
    .with({ type: tenantAttributeType.CERTIFIED }, (attribute) => ({
      sealedValue: {
        oneofKind: "certifiedAttribute",
        certifiedAttribute: {
          id: attribute.id,
          assignmentTimestamp: dateToBigInt(attribute.assignmentTimestamp),
          revocationTimestamp: dateToBigInt(attribute.revocationTimestamp),
        },
      },
    }))
    .with({ type: tenantAttributeType.VERIFIED }, (attribute) => ({
      sealedValue: {
        oneofKind: "verifiedAttribute",
        verifiedAttribute: {
          id: attribute.id,
          assignmentTimestamp: dateToBigInt(attribute.assignmentTimestamp),
          verifiedBy: attribute.verifiedBy.map(toTenantVerifierV1),
          revokedBy: attribute.revokedBy.map(toTenantRevokerV1),
        },
      },
    }))
    .with({ type: tenantAttributeType.DECLARED }, (attribute) => ({
      sealedValue: {
        oneofKind: "declaredAttribute",
        declaredAttribute: {
          id: attribute.id,
          assignmentTimestamp: dateToBigInt(attribute.assignmentTimestamp),
          revocationTimestamp: dateToBigInt(attribute.revocationTimestamp),
        },
      },
    }))
    .exhaustive();
}

function toTenantMailV1(mail: TenantMail): TenantMailV1 {
  return {
    id: mail.id ?? undefined,
    kind: toTenantMailKindV1(mail.kind),
    address: mail.address,
    createdAt: dateToBigInt(mail.createdAt),
    description: mail.description ?? undefined,
  };
}

function toTenantMailKindV1(kind: TenantMailKind): TenantMailKindV1 {
  return match(kind)
    .with(tenantMailKind.ContactEmail, () => TenantMailKindV1.CONTACT_EMAIL)
    .with(tenantMailKind.DigitalAddress, () => TenantMailKindV1.DIGITAL_ADDRESS)
    .exhaustive();
}

function toTenantKindV1(input: TenantKind): TenantKindV1 {
  return match<TenantKind, TenantKindV1>(input)
    .with(tenantKind.GSP, () => TenantKindV1.GSP)
    .with(tenantKind.PA, () => TenantKindV1.PA)
    .with(tenantKind.PRIVATE, () => TenantKindV1.PRIVATE)
    .otherwise(() => {
      throw new Error("Unsupported tenant kind");
    });
}

function toTenantUnitTypeV1(input: TenantUnitType): TenantUnitTypeV1 {
  return match<TenantUnitType, TenantUnitTypeV1>(input)
    .with(tenantUnitType.AOO, () => TenantUnitTypeV1.AOO)
    .with(tenantUnitType.UO, () => TenantUnitTypeV1.UO)
    .exhaustive();
}

export const toTenantV1 = (tenant: Tenant): TenantV1 => ({
  ...tenant,
  features: tenant.features.map(toFeatureV1),
  attributes: tenant.attributes.map(toAttributeV1),
  createdAt: dateToBigInt(tenant.createdAt),
  updatedAt: dateToBigInt(tenant.updatedAt),
  mails: tenant.mails.map(toTenantMailV1),
  kind: tenant.kind ? toTenantKindV1(tenant.kind) : undefined,
  onboardedAt: dateToBigInt(tenant.createdAt),
  subUnitType: tenant.subUnitType
    ? toTenantUnitTypeV1(tenant.subUnitType)
    : undefined,
});
