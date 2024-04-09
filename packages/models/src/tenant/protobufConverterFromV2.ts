import { createHash } from "crypto";
import { match } from "ts-pattern";
import { unsafeBrandId } from "../brandedIds.js";
import { genericError } from "../errors.js";
import {
  TenantKindV2,
  TenantMailKindV2,
  TenantMailV2,
  TenantFeatureV2,
  TenantVerifierV2,
  TenantRevokerV2,
  TenantAttributeV2,
  TenantV2,
  TenantUnitTypeV2,
} from "../gen/v2/tenant/tenant.js";
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

export const fromTenantKindV2 = (input: TenantKindV2): TenantKind => {
  switch (input) {
    case TenantKindV2.GSP:
      return tenantKind.GSP;
    case TenantKindV2.PA:
      return tenantKind.PA;
    case TenantKindV2.PRIVATE:
      return tenantKind.PRIVATE;
  }
};

export const fromTenantMailKindV2 = (
  input: TenantMailKindV2
): TenantMailKind => {
  switch (input) {
    case TenantMailKindV2.CONTACT_EMAIL:
      return tenantMailKind.ContactEmail;
    case TenantMailKindV2.DIGITAL_ADDRESS:
      return tenantMailKind.DigitalAddress;
  }
};

export const fromTenantMailV2 = (input: TenantMailV2): TenantMail => ({
  ...input,
  id: input.id ?? createHash("sha256").update(input.address).digest("hex"),
  createdAt: new Date(Number(input.createdAt)),
  kind: fromTenantMailKindV2(input.kind),
});

export const fromTenantFeatureV2 = (
  input: TenantFeatureV2
): TenantFeatureCertifier =>
  match<TenantFeatureV2["sealedValue"], TenantFeatureCertifier>(
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

export const fromTenantVerifierV2 = (
  input: TenantVerifierV2
): TenantVerifier => ({
  ...input,
  verificationDate: new Date(Number(input.verificationDate)),
  expirationDate: input.expirationDate
    ? new Date(Number(input.expirationDate))
    : undefined,
  extensionDate: input.extensionDate
    ? new Date(Number(input.extensionDate))
    : undefined,
});

export const fromTenantRevokerV2 = (input: TenantRevokerV2): TenantRevoker => ({
  ...input,
  expirationDate: input.expirationDate
    ? new Date(Number(input.expirationDate))
    : undefined,
  extensionDate: input.extensionDate
    ? new Date(Number(input.extensionDate))
    : undefined,
  revocationDate: new Date(Number(input.revocationDate)),
  verificationDate: new Date(Number(input.verificationDate)),
});

export const fromTenantAttributesV2 = (
  input: TenantAttributeV2
): TenantAttribute => {
  const { sealedValue } = input;

  switch (sealedValue.oneofKind) {
    case "certifiedAttribute":
      const { certifiedAttribute } = sealedValue;
      return {
        id: unsafeBrandId(certifiedAttribute.id),
        assignmentTimestamp: new Date(
          Number(certifiedAttribute.assignmentTimestamp)
        ),
        type: tenantAttributeType.CERTIFIED,
      };
    case "verifiedAttribute":
      const { verifiedAttribute } = sealedValue;
      return {
        id: unsafeBrandId(verifiedAttribute.id),
        assignmentTimestamp: new Date(
          Number(verifiedAttribute.assignmentTimestamp)
        ),
        verifiedBy: verifiedAttribute.verifiedBy.map(fromTenantVerifierV2),
        revokedBy: verifiedAttribute.revokedBy.map(fromTenantRevokerV2),
        type: tenantAttributeType.VERIFIED,
      };
    case "declaredAttribute":
      const { declaredAttribute } = sealedValue;
      return {
        id: unsafeBrandId(declaredAttribute.id),
        assignmentTimestamp: new Date(
          Number(declaredAttribute.assignmentTimestamp)
        ),
        type: tenantAttributeType.DECLARED,
      };
    default:
      throw genericError(`Invalid attribute kind: ${sealedValue.oneofKind}`);
  }
};

export const fromTenantUnitTypeV2 = (
  input: TenantUnitTypeV2
): TenantUnitType => {
  switch (input) {
    case TenantUnitTypeV2.AOO:
      return tenantUnitType.AOO;
    case TenantUnitTypeV2.UO:
      return tenantUnitType.UO;
  }
};

export const fromTenantV2 = (input: TenantV2): Tenant => {
  /**
   * The `externalId` field is required in the TenantV2 protobuf model but
   * for some reasons the @protobuf-ts/protoc library generates it as optional.
   * This issue has been reported here: https://github.com/timostamm/protobuf-ts/issues/340
   */
  const externalId = ExternalId.safeParse(input.externalId);
  if (!externalId.success) {
    throw genericError(
      `Error while deserializing TenantV2 (${input.id}): missing externalId`
    );
  }

  return {
    ...input,
    id: unsafeBrandId(input.id),
    name: input.name ?? "",
    createdAt: new Date(Number(input.createdAt)),
    attributes: input.attributes.map(fromTenantAttributesV2),
    externalId: externalId.data,
    features: input.features.map(fromTenantFeatureV2),
    mails: input.mails.map(fromTenantMailV2),
    kind: input.kind ? fromTenantKindV2(input.kind) : undefined,
    updatedAt: input.updatedAt ? new Date(Number(input.updatedAt)) : undefined,
    onboardedAt: input.onboardedAt
      ? new Date(Number(input.onboardedAt))
      : undefined,
    subUnitType: input.subUnitType
      ? fromTenantUnitTypeV2(input.subUnitType)
      : undefined,
  };
};
