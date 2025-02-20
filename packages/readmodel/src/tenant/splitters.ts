import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  TenantAttribute,
  tenantAttributeType,
  TenantFeatureCertifier,
  TenantFeatureDelegatedConsumer,
  TenantFeatureDelegatedProducer,
  tenantFeatureType,
  TenantId,
  TenantMail,
  Tenant,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  dateToString,
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
} from "pagopa-interop-readmodel-models";

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
  }: Tenant,
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
    createdAt: dateToString(createdAt),
    updatedAt: dateToString(updatedAt),
    name,
    onboardedAt: dateToString(onboardedAt),
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
        certifierId: feature.certifierId,
        availabilityTimestamp: null,
      }))
      .with({ type: tenantFeatureType.delegatedProducer }, (feature) => ({
        tenantId: id,
        metadataVersion,
        kind: tenantFeatureType.delegatedProducer,
        certifierId: null,
        availabilityTimestamp: dateToString(feature.availabilityTimestamp),
      }))
      .with({ type: tenantFeatureType.delegatedConsumer }, (feature) => ({
        tenantId: id,
        metadataVersion,
        kind: tenantFeatureType.delegatedConsumer,
        certifierId: null,
        availabilityTimestamp: dateToString(feature.availabilityTimestamp),
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
  { id, kind, address, description, createdAt, ...rest }: TenantMail,
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
    createdAt: dateToString(createdAt),
  };
};

const splitTenantAttributesIntoObjectsSQL = (
  tenantAttributes: TenantAttribute[],
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
        }: Omit<CertifiedTenantAttribute, "type">) => {
          void (rest satisfies Record<string, never>);

          const tenantCertifiedAttributeSQL: TenantCertifiedAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp: dateToString(assignmentTimestamp),
            revocationTimestamp: dateToString(revocationTimestamp),
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
        }: Omit<DeclaredTenantAttribute, "type">) => {
          void (rest satisfies Record<string, never>);

          const tenantDeclaredAttributeSQL: TenantDeclaredAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp: dateToString(assignmentTimestamp),
            revocationTimestamp: dateToString(revocationTimestamp),
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
        }: Omit<VerifiedTenantAttribute, "type">) => {
          void (rest satisfies Record<string, never>);

          const verifiedTenantAttributeSQL: TenantVerifiedAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp: dateToString(assignmentTimestamp),
          };
          // eslint-disable-next-line functional/immutable-data
          tenantVerifiedAttributesSQL.push(verifiedTenantAttributeSQL);

          const verifiersOfCurrentAttribute: TenantVerifiedAttributeVerifierSQL[] =
            verifiedBy.map(
              ({
                id,
                verificationDate,
                expirationDate,
                extensionDate,
                delegationId,
              }: TenantVerifier) => {
                void (rest satisfies Record<string, never>);

                return {
                  tenantId,
                  metadataVersion,
                  id,
                  tenantVerifiedAttributeId: attr.id,
                  verificationDate: dateToString(verificationDate),
                  expirationDate: dateToString(expirationDate),
                  extensionDate: dateToString(extensionDate),
                  delegationId: delegationId || null,
                };
              }
            );

          // eslint-disable-next-line functional/immutable-data
          tenantVerifiedAttributeVerifiersSQL.push(
            ...verifiersOfCurrentAttribute
          );

          const revokersOfCurrentAttribute: TenantVerifiedAttributeRevokerSQL[] =
            revokedBy.map(
              ({
                id,
                verificationDate,
                expirationDate,
                extensionDate,
                revocationDate,
                delegationId,
              }: TenantRevoker) => ({
                tenantId,
                metadataVersion,
                id,
                tenantVerifiedAttributeId: attr.id,
                verificationDate: dateToString(verificationDate),
                expirationDate: dateToString(expirationDate),
                extensionDate: dateToString(extensionDate),
                revocationDate: dateToString(revocationDate),
                delegationId: delegationId || null,
              })
            );

          // eslint-disable-next-line functional/immutable-data
          tenantVerifiedAttributeRevokersSQL.push(
            ...revokersOfCurrentAttribute
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
