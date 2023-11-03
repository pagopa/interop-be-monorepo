import {
  Tenant,
  TenantAttribute,
  TenantVerifier,
  TenantRevoker,
  TenantAttributeV1,
  TenantRevokerV1,
  TenantV1,
  TenantVerifierV1,
  TenantFeatureV1,
  TenantFeature,
  TenantMailV1,
  TenantMail,
  TenantMailKindV1,
  TenantMailKind,
  tenantMailKind,
  TenantKindV1,
  TenantKind,
  tenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const fromTenantKindV1 = (input: TenantKindV1): TenantKind => {
  switch (input) {
    case TenantKindV1.GSP:
      return tenantKind.gsp;
    case TenantKindV1.PA:
      return tenantKind.pa;
    case TenantKindV1.PRIVATE:
      return tenantKind.private;
    case TenantKindV1.UNSPECIFIED$:
      throw new Error("Unspecified tenant kind");
  }
};

export const fromTenantMailKindV1 = (
  input: TenantMailKindV1
): TenantMailKind => {
  switch (input) {
    case TenantMailKindV1.CONTACT_EMAIL:
      return tenantMailKind.contactMail;
    case TenantMailKindV1.UNSPECIFIED$:
      throw new Error("Unspecified tenant mail kind");
  }
};

export const fromTenantMailV1 = (input: TenantMailV1): TenantMail => ({
  address: input.address,
  description: input.description,
  createdAt: new Date(Number(input.createdAt)),
  kind: fromTenantMailKindV1(input.kind),
});

export const fromTenantFeatureV1 = (input: TenantFeatureV1): TenantFeature =>
  match<TenantFeatureV1["sealedValue"], TenantFeature>(input.sealedValue)
    .with({ oneofKind: "certifier" }, ({ certifier }) => ({
      type: "Certifier",
      certifierId: certifier.certifierId,
    }))
    .with({ oneofKind: undefined }, () => {
      throw new Error("Unable to deserialize TenantFeature");
    })
    .exhaustive();

export const fromTenantVerifierV1 = (
  input: TenantVerifierV1
): TenantVerifier => ({
  id: input.id,
  verificationDate: new Date(Number(input.verificationDate)),
  expirationDate: input.expirationDate
    ? new Date(Number(input.expirationDate))
    : undefined,
  extensionDate: input.extensionDate
    ? new Date(Number(input.extensionDate))
    : undefined,
});

export const fromTenantRevokerV1 = (input: TenantRevokerV1): TenantRevoker => ({
  id: input.id,
  expirationDate: input.expirationDate
    ? new Date(Number(input.expirationDate))
    : undefined,
  extensionDate: input.extensionDate
    ? new Date(Number(input.extensionDate))
    : undefined,
  revocationDate: new Date(Number(input.revocationDate)),
  verificationDate: new Date(Number(input.verificationDate)),
});

export const fromTenantAttributesV1 = (
  input: TenantAttributeV1
): TenantAttribute =>
  match<TenantAttributeV1["sealedValue"], TenantAttribute>(input.sealedValue)
    .with({ oneofKind: "certifiedAttribute" }, ({ certifiedAttribute }) => ({
      id: certifiedAttribute.id,
      assignmentTimestamp: new Date(
        Number(certifiedAttribute.assignmentTimestamp)
      ),
      type: "CertifiedAttribute",
    }))
    .with({ oneofKind: "verifiedAttribute" }, ({ verifiedAttribute }) => ({
      id: verifiedAttribute.id,
      assignmentTimestamp: new Date(
        Number(verifiedAttribute.assignmentTimestamp)
      ),
      verifiedBy: verifiedAttribute.verifiedBy.map(fromTenantVerifierV1),
      revokedBy: verifiedAttribute.revokedBy.map(fromTenantRevokerV1),
      type: "VerifiedAttribute",
    }))
    .with({ oneofKind: "declaredAttribute" }, ({ declaredAttribute }) => ({
      id: declaredAttribute.id,
      assignmentTimestamp: new Date(
        Number(declaredAttribute.assignmentTimestamp)
      ),
      type: "DeclaredAttribute",
    }))
    .otherwise(() => {
      throw new Error("Booom"); // Ported "as is" from Scala codebase :D
    });

export const fromTenantV1 = (input: TenantV1): Tenant => {
  /**
   * The `externalId` field is required in the TenantV1 protobuf model but
   * for some reasons the @protobuf-ts/protoc library generates it as optional.
   * This issue has been reported here: https://github.com/timostamm/protobuf-ts/issues/340
   */
  if (!input.externalId) {
    throw new Error(
      `Error while deserializing TenantV1 (${input.id}): missing externalId`
    );
  }

  return {
    id: input.id,
    selfcareId: input.selfcareId,
    name: input.name ?? "",
    createdAt: new Date(Number(input.createdAt)),
    attributes: input.attributes.map(fromTenantAttributesV1),
    externalId: input.externalId,
    features: input.features.map(fromTenantFeatureV1),
    mails: input.mails.map(fromTenantMailV1),
    kind: input.kind ? fromTenantKindV1(input.kind) : undefined,
    updatedAt: input.updatedAt ? new Date(Number(input.updatedAt)) : undefined,
  };
};
