import { match } from "ts-pattern";

import { genericError } from "../errors.js";
import {
  TenantAttributeV3,
  TenantContactV3,
  TenantFeatureV3,
  TenantKindV3,
  TenantRemoteIdV3,
  TenantRevokerV3,
  TenantUnitTypeV3,
  TenantV3,
  TenantVerifierV3,
} from "../gen/v3/tenant/tenant.js";
import { dateToBigInt } from "../utils.js";
import {
  Tenant,
  TenantAttribute,
  TenantContact,
  TenantFeature,
  TenantKind,
  TenantRemoteId,
  TenantRevoker,
  TenantUnitType,
  TenantVerifier,
  tenantAttributeType,
  tenantKind,
  tenantUnitType,
} from "./tenant.js";

export function toFeatureV3(feature: TenantFeature): TenantFeatureV3 {
  return match<TenantFeature, TenantFeatureV3>(feature)
    .with({ type: "PersistentCertifier" }, (feature) => ({
      sealedValue: {
        oneofKind: "certifier",
        certifier: {
          certifierId: feature.certifierId,
        },
      },
    }))
    .with({ type: "DelegatedProducer" }, (feature) => ({
      sealedValue: {
        oneofKind: "delegatedProducer",
        delegatedProducer: {
          availabilityTimestamp: dateToBigInt(feature.availabilityTimestamp),
        },
      },
    }))
    .with({ type: "DelegatedConsumer" }, (feature) => ({
      sealedValue: {
        oneofKind: "delegatedConsumer",
        delegatedConsumer: {
          availabilityTimestamp: dateToBigInt(feature.availabilityTimestamp),
        },
      },
    }))
    .exhaustive();
}

export function toTenantVerifierV3(verifier: TenantVerifier): TenantVerifierV3 {
  return {
    id: verifier.id,
    delegationId: verifier.delegationId,
    verificationDate: dateToBigInt(verifier.verificationDate),
    expirationDate: dateToBigInt(verifier.expirationDate),
    extensionDate: dateToBigInt(verifier.extensionDate),
  };
}

export function toTenantRevokerV3(revoker: TenantRevoker): TenantRevokerV3 {
  return {
    id: revoker.id,
    delegationId: revoker.delegationId,
    verificationDate: dateToBigInt(revoker.verificationDate),
    expirationDate: dateToBigInt(revoker.expirationDate),
    extensionDate: dateToBigInt(revoker.extensionDate),
    revocationDate: dateToBigInt(revoker.revocationDate),
  };
}

export function toAttributeV3(input: TenantAttribute): TenantAttributeV3 {
  return match<TenantAttribute, TenantAttributeV3>(input)
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
          verifiedBy: attribute.verifiedBy.map(toTenantVerifierV3),
          revokedBy: attribute.revokedBy.map(toTenantRevokerV3),
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
          delegationId: attribute.delegationId,
        },
      },
    }))
    .with({ type: tenantAttributeType.CERTIFIED_DISCRETE }, (attribute) => ({
      sealedValue: {
        oneofKind: "certifiedDiscreteAttribute",
        certifiedDiscreteAttribute: {
          id: attribute.id,
          assignmentTimestamp: dateToBigInt(attribute.assignmentTimestamp),
          revocationTimestamp: dateToBigInt(attribute.revocationTimestamp),
          discreteValue: attribute.discreteValue,
        },
      },
    }))
    .exhaustive();
}

export function toTenantKindV3(input: TenantKind): TenantKindV3 {
  return match<TenantKind, TenantKindV3>(input)
    .with(tenantKind.GSP, () => TenantKindV3.GSP)
    .with(tenantKind.PA, () => TenantKindV3.PA)
    .with(tenantKind.PRIVATE, () => TenantKindV3.PRIVATE)
    .with(tenantKind.SCP, () => TenantKindV3.SCP)
    .exhaustive();
}

export function toTenantUnitTypeV3(input: TenantUnitType): TenantUnitTypeV3 {
  return match<TenantUnitType, TenantUnitTypeV3>(input)
    .with(tenantUnitType.AOO, () => TenantUnitTypeV3.AOO)
    .with(tenantUnitType.UO, () => TenantUnitTypeV3.UO)
    .exhaustive();
}

export function toRemoteIdsV3(remoteId: TenantRemoteId): TenantRemoteIdV3 {
  return {
    origin: remoteId.origin,
    value: remoteId.value,
    assignmentTimestamp: dateToBigInt(remoteId.assignmentTimestamp),
  };
}

export function toTenantContactV3(contact: TenantContact): TenantContactV3 {
  return {
    contactId: contact.contactId,
    createdAt: dateToBigInt(contact.createdAt),
  };
}

function checkSelfcareId(selfcareId: string | undefined): string {
  if (selfcareId === undefined) {
    throw new Error("SelfcareId can't be undefined");
  }
  return selfcareId;
}

/**
 * V3 events must never carry plain-text contact data: a tenant that still
 * holds legacy mails (decoded from V1/V2 events) cannot be serialized to V3.
 */
function checkNoLegacyMails(tenant: Tenant): void {
  if (tenant.mails.length > 0) {
    throw genericError(
      `Tenant ${tenant.id} has legacy mails and cannot be serialized to V3`
    );
  }
}

export const toTenantV3 = (tenant: Tenant): TenantV3 => {
  checkNoLegacyMails(tenant);

  return {
    id: tenant.id,
    selfcareId: checkSelfcareId(tenant.selfcareId),
    externalId: tenant.externalId,
    features: tenant.features.map(toFeatureV3),
    attributes: tenant.attributes.map(toAttributeV3),
    createdAt: dateToBigInt(tenant.createdAt),
    updatedAt: dateToBigInt(tenant.updatedAt),
    name: tenant.name,
    kind: tenant.kind ? toTenantKindV3(tenant.kind) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    onboardedAt: dateToBigInt(tenant.onboardedAt!),
    subUnitType: tenant.subUnitType
      ? toTenantUnitTypeV3(tenant.subUnitType)
      : undefined,
    selfcareInstitutionType: tenant.selfcareInstitutionType,
    remoteIds: (tenant.remoteIds ?? []).map(toRemoteIdsV3),
    contact: tenant.contact ? toTenantContactV3(tenant.contact) : undefined,
  };
};
