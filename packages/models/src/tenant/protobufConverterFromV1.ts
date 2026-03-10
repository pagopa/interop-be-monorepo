import { createHash } from "crypto";
import { match } from "ts-pattern";
import { unsafeBrandId } from "../brandedIds.js";
import { genericError } from "../errors.js";
import {
  TenantKindV1,
  TenantMailKindV1,
  TenantMailV1,
  TenantFeatureV1,
  TenantVerifierV1,
  TenantRevokerV1,
  TenantAttributeV1,
  TenantV1,
  TenantUnitTypeV1,
} from "../gen/v1/tenant/tenant.js";
import { bigIntToDate } from "../utils.js";
import {
  TenantKind,
  tenantKind,
  TenantMailKind,
  tenantMailKind,
  TenantMail,
  TenantFeatureCertifier,
  TenantVerifier,
  TenantRevoker,
  TenantAttribute,
  Tenant,
  ExternalId,
  tenantAttributeType,
  TenantUnitType,
  tenantUnitType,
} from "./tenant.js";

export const fromTenantKindV1 = (input: TenantKindV1): TenantKind => {
  switch (input) {
    case TenantKindV1.GSP:
      return tenantKind.GSP;
    case TenantKindV1.PA:
      return tenantKind.PA;
    case TenantKindV1.PRIVATE:
      return tenantKind.PRIVATE;
    case TenantKindV1.UNSPECIFIED$:
      throw new Error("Unspecified tenant kind");
  }
};

export const fromTenantMailKindV1 = (
  input: TenantMailKindV1
): TenantMailKind => {
  switch (input) {
    case TenantMailKindV1.CONTACT_EMAIL:
      return tenantMailKind.ContactEmail;
    case TenantMailKindV1.DIGITAL_ADDRESS:
      return tenantMailKind.DigitalAddress;
    case TenantMailKindV1.UNSPECIFIED$:
      throw new Error("Unspecified tenant mail kind");
  }
};

export const fromTenantMailV1 = (input: TenantMailV1): TenantMail => ({
  ...input,
  id: input.id
    ? input.id
    : createHash("sha256").update(input.address).digest("hex"),
  createdAt: bigIntToDate(input.createdAt),
  kind: fromTenantMailKindV1(input.kind),
});

export const fromTenantFeatureV1 = (
  input: TenantFeatureV1
): TenantFeatureCertifier =>
  match<TenantFeatureV1["sealedValue"], TenantFeatureCertifier>(
    input.sealedValue
  )
    .with({ oneofKind: "certifier" }, ({ certifier }) => ({
      type: "PersistentCertifier",
      certifierId: certifier.certifierId,
    }))
    .with({ oneofKind: undefined }, () => {
      throw new Error("Unable to deserialize TenantFeature");
    })
    .exhaustive();

export const fromTenantVerifierV1 = (
  input: TenantVerifierV1
): TenantVerifier => ({
  ...input,
  id: unsafeBrandId(input.id),
  verificationDate: bigIntToDate(input.verificationDate),
  expirationDate: bigIntToDate(input.expirationDate),
  extensionDate: bigIntToDate(input.extensionDate),
});

export const fromTenantRevokerV1 = (input: TenantRevokerV1): TenantRevoker => ({
  ...input,
  id: unsafeBrandId(input.id),
  expirationDate: bigIntToDate(input.expirationDate),
  extensionDate: bigIntToDate(input.extensionDate),
  revocationDate: bigIntToDate(input.revocationDate),
  verificationDate: bigIntToDate(input.verificationDate),
});

export const fromTenantAttributesV1 = (
  input: TenantAttributeV1
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
    case "verifiedAttribute": {
      const { verifiedAttribute } = sealedValue;
      return {
        id: unsafeBrandId(verifiedAttribute.id),
        assignmentTimestamp: bigIntToDate(
          verifiedAttribute.assignmentTimestamp
        ),
        verifiedBy: verifiedAttribute.verifiedBy.map(fromTenantVerifierV1),
        revokedBy: verifiedAttribute.revokedBy.map(fromTenantRevokerV1),
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
        type: tenantAttributeType.DECLARED,
      };
    }
    case undefined:
      throw genericError("Undefined attribute kind");
  }
};

export const fromTenantUnitTypeV1 = (
  input: TenantUnitTypeV1
): TenantUnitType => {
  switch (input) {
    case TenantUnitTypeV1.AOO:
      return tenantUnitType.AOO;
    case TenantUnitTypeV1.UO:
      return tenantUnitType.UO;
    case TenantUnitTypeV1.UNSPECIFIED$:
      throw new Error("Unspecified tenant unit type");
  }
};

export const fromTenantV1 = (input: TenantV1): Tenant => {
  /**
   * The `externalId` field is required in the TenantV1 protobuf model but
   * for some reasons the @protobuf-ts/protoc library generates it as optional.
   * This issue has been reported here: https://github.com/timostamm/protobuf-ts/issues/340
   */
  const externalId = ExternalId.safeParse(input.externalId);
  if (!externalId.success) {
    throw genericError(
      `Error while deserializing TenantV1 (${input.id}): missing externalId`
    );
  }

  return {
    ...input,
    id: unsafeBrandId(input.id),
    name: input.name ?? "",
    createdAt: bigIntToDate(input.createdAt),
    attributes: input.attributes.map(fromTenantAttributesV1),
    externalId: externalId.data,
    features: input.features.map(fromTenantFeatureV1),
    mails: input.mails.map(fromTenantMailV1),
    kind: input.kind ? fromTenantKindV1(input.kind) : undefined,
    updatedAt: bigIntToDate(input.updatedAt),
    onboardedAt: bigIntToDate(input.onboardedAt),
    subUnitType: input.subUnitType
      ? fromTenantUnitTypeV1(input.subUnitType)
      : undefined,
  };
};
