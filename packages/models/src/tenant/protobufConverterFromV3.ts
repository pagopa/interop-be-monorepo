import { match } from "ts-pattern";

import { ContactId, DelegationId, unsafeBrandId } from "../brandedIds.js";
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
import { bigIntToDate } from "../utils.js";
import {
  ExternalId,
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

export const fromTenantKindV3 = (input: TenantKindV3): TenantKind => {
  switch (input) {
    case TenantKindV3.GSP:
      return tenantKind.GSP;
    case TenantKindV3.PA:
      return tenantKind.PA;
    case TenantKindV3.PRIVATE:
      return tenantKind.PRIVATE;
    case TenantKindV3.SCP:
      return tenantKind.SCP;
  }
};

export const fromTenantFeatureV3 = (input: TenantFeatureV3): TenantFeature =>
  match<TenantFeatureV3["sealedValue"], TenantFeature>(input.sealedValue)
    .with({ oneofKind: "certifier" }, ({ certifier }) => ({
      type: "PersistentCertifier",
      certifierId: certifier.certifierId,
    }))
    .with({ oneofKind: "delegatedProducer" }, ({ delegatedProducer }) => ({
      type: "DelegatedProducer",
      availabilityTimestamp: bigIntToDate(
        delegatedProducer.availabilityTimestamp
      ),
    }))
    .with({ oneofKind: "delegatedConsumer" }, ({ delegatedConsumer }) => ({
      type: "DelegatedConsumer",
      availabilityTimestamp: bigIntToDate(
        delegatedConsumer.availabilityTimestamp
      ),
    }))
    .with({ oneofKind: undefined }, () => {
      throw new Error("Unable to deserialize TenantFeature");
    })
    .exhaustive();

export const fromTenantVerifierV3 = (
  input: TenantVerifierV3
): TenantVerifier => ({
  id: unsafeBrandId(input.id),
  delegationId: input.delegationId
    ? unsafeBrandId<DelegationId>(input.delegationId)
    : undefined,
  verificationDate: bigIntToDate(input.verificationDate),
  expirationDate: bigIntToDate(input.expirationDate),
  extensionDate: bigIntToDate(input.extensionDate),
});

export const fromTenantRevokerV3 = (input: TenantRevokerV3): TenantRevoker => ({
  id: unsafeBrandId(input.id),
  delegationId: input.delegationId
    ? unsafeBrandId<DelegationId>(input.delegationId)
    : undefined,
  expirationDate: bigIntToDate(input.expirationDate),
  extensionDate: bigIntToDate(input.extensionDate),
  revocationDate: bigIntToDate(input.revocationDate),
  verificationDate: bigIntToDate(input.verificationDate),
});

export const fromTenantAttributesV3 = (
  input: TenantAttributeV3
): TenantAttribute => {
  const { sealedValue } = input;

  switch (sealedValue.oneofKind) {
    case "certifiedAttribute": {
      const { certifiedAttribute } = sealedValue;
      return {
        id: unsafeBrandId(certifiedAttribute.id),
        assignmentTimestamp: bigIntToDate(
          certifiedAttribute.assignmentTimestamp
        ),
        revocationTimestamp: bigIntToDate(
          certifiedAttribute.revocationTimestamp
        ),
        type: tenantAttributeType.CERTIFIED,
      };
    }
    case "certifiedDiscreteAttribute": {
      const { certifiedDiscreteAttribute } = sealedValue;
      return {
        id: unsafeBrandId(certifiedDiscreteAttribute.id),
        assignmentTimestamp: bigIntToDate(
          certifiedDiscreteAttribute.assignmentTimestamp
        ),
        revocationTimestamp: bigIntToDate(
          certifiedDiscreteAttribute.revocationTimestamp
        ),
        discreteValue: certifiedDiscreteAttribute.discreteValue,
        type: tenantAttributeType.CERTIFIED_DISCRETE,
      };
    }
    case "verifiedAttribute": {
      const { verifiedAttribute } = sealedValue;
      return {
        id: unsafeBrandId(verifiedAttribute.id),
        assignmentTimestamp: bigIntToDate(
          verifiedAttribute.assignmentTimestamp
        ),
        verifiedBy: verifiedAttribute.verifiedBy.map(fromTenantVerifierV3),
        revokedBy: verifiedAttribute.revokedBy.map(fromTenantRevokerV3),
        type: tenantAttributeType.VERIFIED,
      };
    }
    case "declaredAttribute": {
      const { declaredAttribute } = sealedValue;
      return {
        id: unsafeBrandId(declaredAttribute.id),
        assignmentTimestamp: bigIntToDate(
          declaredAttribute.assignmentTimestamp
        ),
        revocationTimestamp: bigIntToDate(
          declaredAttribute.revocationTimestamp
        ),
        delegationId: declaredAttribute.delegationId
          ? unsafeBrandId<DelegationId>(declaredAttribute.delegationId)
          : undefined,
        type: tenantAttributeType.DECLARED,
      };
    }
    case undefined:
      throw genericError("Undefined attribute kind");
  }
};

export const fromTenantUnitTypeV3 = (
  input: TenantUnitTypeV3
): TenantUnitType => {
  switch (input) {
    case TenantUnitTypeV3.AOO:
      return tenantUnitType.AOO;
    case TenantUnitTypeV3.UO:
      return tenantUnitType.UO;
  }
};

export const fromRemoteIdsV3 = (
  remoteId: TenantRemoteIdV3
): TenantRemoteId => ({
  origin: remoteId.origin,
  value: remoteId.value,
  assignmentTimestamp: bigIntToDate(remoteId.assignmentTimestamp),
});

export const fromTenantContactV3 = (
  contact: TenantContactV3
): TenantContact => ({
  contactId: unsafeBrandId<ContactId>(contact.contactId),
  createdAt: bigIntToDate(contact.createdAt),
});

export const fromTenantV3 = (input: TenantV3): Tenant => {
  /**
   * The `externalId` field is required in the TenantV3 protobuf model but
   * for some reasons the @protobuf-ts/protoc library generates it as optional.
   * This issue has been reported here: https://github.com/timostamm/protobuf-ts/issues/340
   */
  const externalId = ExternalId.safeParse(input.externalId);
  if (!externalId.success) {
    throw genericError(
      `Error while deserializing TenantV3 (${input.id}): missing externalId`
    );
  }

  return {
    id: unsafeBrandId(input.id),
    selfcareId: input.selfcareId,
    name: input.name ?? "",
    createdAt: bigIntToDate(input.createdAt),
    attributes: input.attributes.map(fromTenantAttributesV3),
    externalId: externalId.data,
    features: input.features.map(fromTenantFeatureV3),
    // V3 events never carry plain-text mails: the tenant references its
    // contact through `contact` instead.
    mails: [],
    contact: input.contact ? fromTenantContactV3(input.contact) : undefined,
    kind: input.kind != null ? fromTenantKindV3(input.kind) : undefined,
    updatedAt: bigIntToDate(input.updatedAt),
    onboardedAt: bigIntToDate(input.onboardedAt),
    subUnitType:
      input.subUnitType != null
        ? fromTenantUnitTypeV3(input.subUnitType)
        : undefined,
    selfcareInstitutionType: input.selfcareInstitutionType,
    remoteIds: input.remoteIds.map(fromRemoteIdsV3),
  };
};
