import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  TenantAttribute,
  tenantAttributeType,
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
  TenantItemsSQL,
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
): TenantItemsSQL => {
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

  const mailsSQL: TenantMailSQL[] = mails.map((mail) =>
    tenantMailToTenantMailSQL(mail, id, metadataVersion)
  );

  const {
    certifiedAttributesSQL,
    declaredAttributesSQL,
    verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL,
  } = splitTenantAttributesIntoObjectsSQL(attributes, id, metadataVersion);

  const featuresSQL: TenantFeatureSQL[] = features.map((feature) =>
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
    mailsSQL,
    certifiedAttributesSQL,
    declaredAttributesSQL,
    verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL,
    featuresSQL,
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
  attributes: TenantAttribute[],
  tenantId: TenantId,
  metadataVersion: number
): {
  certifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  declaredAttributesSQL: TenantDeclaredAttributeSQL[];
  verifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  verifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  verifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
} => {
  const certifiedAttributesSQL: TenantCertifiedAttributeSQL[] = [];
  const declaredAttributesSQL: TenantDeclaredAttributeSQL[] = [];
  const verifiedAttributesSQL: TenantVerifiedAttributeSQL[] = [];
  const verifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[] =
    [];
  const verifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[] = [];

  attributes.forEach((attr) => {
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

          const certifiedAttributeSQL: TenantCertifiedAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp: dateToString(assignmentTimestamp),
            revocationTimestamp: dateToString(revocationTimestamp),
          };
          // eslint-disable-next-line functional/immutable-data
          certifiedAttributesSQL.push(certifiedAttributeSQL);
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

          const declaredAttributeSQL: TenantDeclaredAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp: dateToString(assignmentTimestamp),
            revocationTimestamp: dateToString(revocationTimestamp),
            delegationId: delegationId || null,
          };
          // eslint-disable-next-line functional/immutable-data
          declaredAttributesSQL.push(declaredAttributeSQL);
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

          const verifiedAttributeSQL: TenantVerifiedAttributeSQL = {
            attributeId: id,
            tenantId,
            metadataVersion,
            assignmentTimestamp: dateToString(assignmentTimestamp),
          };
          // eslint-disable-next-line functional/immutable-data
          verifiedAttributesSQL.push(verifiedAttributeSQL);

          const verifiersOfCurrentAttribute: TenantVerifiedAttributeVerifierSQL[] =
            verifiedBy.map(
              ({
                id,
                verificationDate,
                expirationDate,
                extensionDate,
                delegationId,
                ...verifierRest
              }: TenantVerifier) => {
                void (verifierRest satisfies Record<string, never>);

                return {
                  tenantId,
                  metadataVersion,
                  tenantVerifierId: id,
                  tenantVerifiedAttributeId: attr.id,
                  verificationDate: dateToString(verificationDate),
                  expirationDate: dateToString(expirationDate),
                  extensionDate: dateToString(extensionDate),
                  delegationId: delegationId || null,
                };
              }
            );

          // eslint-disable-next-line functional/immutable-data
          verifiedAttributeVerifiersSQL.push(...verifiersOfCurrentAttribute);

          const revokersOfCurrentAttribute: TenantVerifiedAttributeRevokerSQL[] =
            revokedBy.map(
              ({
                id,
                verificationDate,
                expirationDate,
                extensionDate,
                revocationDate,
                delegationId,
                ...revokerRest
              }: TenantRevoker) => {
                void (revokerRest satisfies Record<string, never>);

                return {
                  tenantId,
                  metadataVersion,
                  tenantRevokerId: id,
                  tenantVerifiedAttributeId: attr.id,
                  verificationDate: dateToString(verificationDate),
                  expirationDate: dateToString(expirationDate),
                  extensionDate: dateToString(extensionDate),
                  revocationDate: dateToString(revocationDate),
                  delegationId: delegationId || null,
                };
              }
            );

          // eslint-disable-next-line functional/immutable-data
          verifiedAttributeRevokersSQL.push(...revokersOfCurrentAttribute);
        }
      )
      .exhaustive();
  });

  return {
    certifiedAttributesSQL,
    declaredAttributesSQL,
    verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL,
  };
};
