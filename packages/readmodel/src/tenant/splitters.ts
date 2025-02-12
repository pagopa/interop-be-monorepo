import {
  CertifiedTenantAttributeReadModel,
  DeclaredTenantAttributeReadModel,
  TenantAttributeReadModel,
  tenantAttributeType,
  TenantFeatureCertifier,
  TenantFeatureDelegatedConsumer,
  TenantFeatureDelegatedProducer,
  tenantFeatureType,
  TenantId,
  TenantMailReadModel,
  TenantReadModel,
  TenantRevokerReadModel,
  TenantVerifierReadModel,
  VerifiedTenantAttributeReadModel,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantFeatureSQL,
  TenantMailSQL,
  TenantSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
} from "../types.js";

export const splitTenantIntoObjectsSQL = (
  {
    id,
    kind,
    selfcareId,
    externalId,
    features,
    attributes,
    createdAt,
    updatedAt,
    mails,
    name,
    onboardedAt,
    subUnitType,
    ...rest
  }: TenantReadModel,
  metadataVersion: number
): {
  tenantSQL: TenantSQL;
  tenantMailsSQL: TenantMailSQL[];
  tenantCertifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  tenantDeclaredAttributesSQL: TenantDeclaredAttributeSQL[];
  tenantVerifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  tenantVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  tenantVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
  tenantFeaturesSQL: TenantFeatureSQL[];
} => {
  void (rest satisfies Record<string, never>);

  const tenantSQL: TenantSQL = {
    id,
    metadataVersion,
    kind: kind || null,
    selfcareId: selfcareId || null,
    externalIdOrigin: externalId.origin,
    externalIdValue: externalId.value,
    createdAt,
    updatedAt: updatedAt || null,
    name,
    onboardedAt: onboardedAt || null,
    subUnitType: subUnitType || null,
  };

  const tenantMailsSQL: TenantMailSQL[] = mails.map((mail) =>
    tenantMailToTenantMailSQL(mail, id, metadataVersion)
  );

  const {
    tenantCertifiedAttributesSQL,
    tenantDeclaredAttributesSQL,
    tenantVerifiedAttributesSQL,
    tenantVerifiedAttributeVerifiersSQL,
    tenantVerifiedAttributeRevokersSQL,
  } = splitTenantAttributesIntoObjectsSQL(attributes, id, metadataVersion);

  const tenantFeaturesSQL: TenantFeatureSQL[] = features.map((feature) =>
    match(feature)
      .with({ type: tenantFeatureType.persistentCertifier }, (feature) => ({
        tenantId: id,
        metadataVersion,
        kind: tenantFeatureType.persistentCertifier,
        details: { certifierId: feature.certifierId } satisfies Omit<
          TenantFeatureCertifier,
          "type"
        >,
      }))
      .with({ type: tenantFeatureType.delegatedProducer }, (feature) => ({
        tenantId: id,
        metadataVersion,
        kind: tenantFeatureType.delegatedProducer,
        details: {
          availabilityTimestamp: feature.availabilityTimestamp,
        } satisfies Omit<TenantFeatureDelegatedProducer, "type">,
      }))
      .with({ type: tenantFeatureType.delegatedConsumer }, (feature) => ({
        tenantId: id,
        metadataVersion,
        kind: tenantFeatureType.delegatedConsumer,
        details: {
          availabilityTimestamp: feature.availabilityTimestamp,
        } satisfies Omit<TenantFeatureDelegatedConsumer, "type">,
      }))
      .exhaustive()
  );

  return {
    tenantSQL,
    tenantMailsSQL,
    tenantCertifiedAttributesSQL,
    tenantDeclaredAttributesSQL,
    tenantVerifiedAttributesSQL,
    tenantVerifiedAttributeVerifiersSQL,
    tenantVerifiedAttributeRevokersSQL,
    tenantFeaturesSQL,
  };
};

const tenantMailToTenantMailSQL = (
  { id, kind, address, description, createdAt, ...rest }: TenantMailReadModel,
  tenantId: TenantId,
  metadataVersion: number
): TenantMailSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    tenantId,
    metadataVersion,
    kind,
    address,
    description: description || null,
    createdAt,
  };
};

const splitTenantAttributesIntoObjectsSQL = (
  tenantAttributes: TenantAttributeReadModel[],
  tenantId: TenantId,
  metadataVersion: number
): {
  tenantCertifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  tenantDeclaredAttributesSQL: TenantDeclaredAttributeSQL[];
  tenantVerifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  tenantVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  tenantVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
} => {
  const tenantCertifiedAttributesSQL: TenantCertifiedAttributeSQL[] = [];
  const tenantDeclaredAttributesSQL: TenantDeclaredAttributeSQL[] = [];
  const tenantVerifiedAttributesSQL: TenantVerifiedAttributeSQL[] = [];
  const tenantVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[] =
    [];
  const tenantVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[] =
    [];

  tenantAttributes.forEach((attr) => {
    match(attr)
      .with(
        { type: tenantAttributeType.CERTIFIED },
        ({
          id,
          assignmentTimestamp,
          revocationTimestamp,
          ...rest
        }: Omit<CertifiedTenantAttributeReadModel, "type">) => {
          void (rest satisfies Record<string, never>);

          const tenantCertifiedAttributeSQL: TenantCertifiedAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp,
            revocationTimestamp: revocationTimestamp || null,
          };
          // eslint-disable-next-line functional/immutable-data
          tenantCertifiedAttributesSQL.push(tenantCertifiedAttributeSQL);
        }
      )
      .with(
        { type: tenantAttributeType.DECLARED },
        ({
          id,
          assignmentTimestamp,
          revocationTimestamp,
          delegationId,
          ...rest
        }: Omit<DeclaredTenantAttributeReadModel, "type">) => {
          void (rest satisfies Record<string, never>);

          const tenantDeclaredAttributeSQL: TenantDeclaredAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp,
            revocationTimestamp: revocationTimestamp || null,
            delegationId: delegationId || null,
          };
          // eslint-disable-next-line functional/immutable-data
          tenantDeclaredAttributesSQL.push(tenantDeclaredAttributeSQL);
        }
      )
      .with(
        { type: tenantAttributeType.VERIFIED },
        ({
          id,
          assignmentTimestamp,
          verifiedBy,
          revokedBy,
          ...rest
        }: Omit<VerifiedTenantAttributeReadModel, "type">) => {
          void (rest satisfies Record<string, never>);

          const verifiedTenantAttributeSQL: TenantVerifiedAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp,
          };
          // eslint-disable-next-line functional/immutable-data
          tenantVerifiedAttributesSQL.push(verifiedTenantAttributeSQL);

          const tenantVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[] =
            verifiedBy.map(
              ({
                id,
                verificationDate,
                expirationDate,
                extensionDate,
                delegationId,
              }: TenantVerifierReadModel) => {
                void (rest satisfies Record<string, never>);

                return {
                  tenantId,
                  metadataVersion,
                  id,
                  tenantVerifiedAttributeId: attr.id,
                  verificationDate,
                  expirationDate: expirationDate || null,
                  extensionDate: extensionDate || null,
                  delegationId: delegationId || null,
                };
              }
            );

          // eslint-disable-next-line functional/immutable-data
          tenantVerifiedAttributeVerifiersSQL.push(
            ...tenantVerifiedAttributeVerifiersSQL
          );

          const tenantVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[] =
            revokedBy.map(
              ({
                id,
                verificationDate,
                expirationDate,
                extensionDate,
                revocationDate,
                delegationId,
              }: TenantRevokerReadModel) => ({
                tenantId,
                metadataVersion,
                id,
                tenantVerifiedAttributeId: attr.id,
                verificationDate,
                expirationDate: expirationDate || null,
                extensionDate: extensionDate || null,
                revocationDate,
                delegationId: delegationId || null,
              })
            );

          // eslint-disable-next-line functional/immutable-data
          tenantVerifiedAttributeRevokersSQL.push(
            ...tenantVerifiedAttributeRevokersSQL
          );
        }
      )
      .exhaustive();
  });

  return {
    tenantCertifiedAttributesSQL,
    tenantDeclaredAttributesSQL,
    tenantVerifiedAttributesSQL,
    tenantVerifiedAttributeVerifiersSQL,
    tenantVerifiedAttributeRevokersSQL,
  };
};
