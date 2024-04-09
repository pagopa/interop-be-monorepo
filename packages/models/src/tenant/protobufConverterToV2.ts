import { match } from "ts-pattern";
import {
  TenantAttributeV2,
  TenantFeatureV2,
  TenantKindV2,
  TenantMailKindV2,
  TenantMailV2,
  TenantRevokerV2,
  TenantUnitTypeV2,
  TenantV2,
  TenantVerifierV2,
} from "../index.js";
import {
  Tenant,
  TenantAttribute,
  TenantFeature,
  TenantKind,
  TenantMail,
  TenantMailKind,
  TenantRevoker,
  TenantUnitType,
  TenantVerifier,
  tenantAttributeType,
  tenantKind,
  tenantMailKind,
  tenantUnitType,
} from "./tenant.js";

export function toFeatureV2(feature: TenantFeature): TenantFeatureV2 {
  return match<TenantFeature, TenantFeatureV2>(feature)
    .with({ type: "PersistentCertifier" }, (feature) => ({
      sealedValue: {
        oneofKind: "certifier",
        certifier: {
          certifierId: feature.certifierId,
        },
      },
    }))
    .exhaustive();
}

export function toTenantVerifierV2(verifier: TenantVerifier): TenantVerifierV2 {
  return {
    id: verifier.id,
    verificationDate: BigInt(verifier.verificationDate.getTime()),
    expirationDate: verifier.expirationDate
      ? BigInt(verifier.expirationDate.getTime())
      : undefined,
    extensionDate: verifier.extensionDate
      ? BigInt(verifier.extensionDate.getTime())
      : undefined,
  };
}

export function toTenantRevokerV2(revoker: TenantRevoker): TenantRevokerV2 {
  return {
    id: revoker.id,
    verificationDate: BigInt(revoker.verificationDate.getTime()),
    expirationDate: revoker.expirationDate
      ? BigInt(revoker.expirationDate.getTime())
      : undefined,
    extensionDate: revoker.extensionDate
      ? BigInt(revoker.extensionDate.getTime())
      : undefined,
    revocationDate: BigInt(revoker.revocationDate.getTime()),
  };
}

export function toAttributeV2(input: TenantAttribute): TenantAttributeV2 {
  return match<TenantAttribute, TenantAttributeV2>(input)
    .with({ type: tenantAttributeType.CERTIFIED }, (attribute) => ({
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
    .with({ type: tenantAttributeType.VERIFIED }, (attribute) => ({
      sealedValue: {
        oneofKind: "verifiedAttribute",
        verifiedAttribute: {
          id: attribute.id,
          assignmentTimestamp: BigInt(attribute.assignmentTimestamp.getTime()),
          verifiedBy: attribute.verifiedBy.map(toTenantVerifierV2),
          revokedBy: attribute.revokedBy.map(toTenantRevokerV2),
        },
      },
    }))
    .with({ type: tenantAttributeType.DECLARED }, (attribute) => ({
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

export function toTenantMailV2(mail: TenantMail): TenantMailV2 {
  return {
    ...mail,
    kind: toTenantMailKindV2(mail.kind),
    createdAt: BigInt(mail.createdAt.getTime()),
    description: mail.description ?? undefined,
  };
}

export function toTenantMailKindV2(kind: TenantMailKind): TenantMailKindV2 {
  return match(kind)
    .with(tenantMailKind.ContactEmail, () => TenantMailKindV2.CONTACT_EMAIL)
    .with(tenantMailKind.DigitalAddress, () => TenantMailKindV2.DIGITAL_ADDRESS)
    .exhaustive();
}

export function toTenantKindV2(input: TenantKind): TenantKindV2 {
  return match<TenantKind, TenantKindV2>(input)
    .with(tenantKind.GSP, () => TenantKindV2.GSP)
    .with(tenantKind.PA, () => TenantKindV2.PA)
    .with(tenantKind.PRIVATE, () => TenantKindV2.PRIVATE)
    .exhaustive();
}

export function toTenantUnitTypeV2(input: TenantUnitType): TenantUnitTypeV2 {
  return match<TenantUnitType, TenantUnitTypeV2>(input)
    .with(tenantUnitType.AOO, () => TenantUnitTypeV2.AOO)
    .with(tenantUnitType.UO, () => TenantUnitTypeV2.UO)
    .exhaustive();
}

export const toTenantV2 = (tenant: Tenant): TenantV2 => ({
  ...tenant,
  selfcareId: tenant.selfcareId || "default",
  features: tenant.features.map(toFeatureV2),
  attributes: tenant.attributes.map(toAttributeV2),
  createdAt: BigInt(tenant.createdAt.getTime()),
  updatedAt: tenant.updatedAt ? BigInt(tenant.updatedAt.getTime()) : undefined,
  mails: tenant.mails.map(toTenantMailV2),
  kind: tenant.kind ? toTenantKindV2(tenant.kind) : undefined,
  onboardedAt: BigInt(tenant.createdAt.getTime()),
  subUnitType: tenant.subUnitType
    ? toTenantUnitTypeV2(tenant.subUnitType)
    : undefined,
});
