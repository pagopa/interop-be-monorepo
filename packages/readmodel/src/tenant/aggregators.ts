import {
  AttributeId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  DelegationId,
  genericInternalError,
  stringToDate,
  Tenant,
  TenantAttribute,
  tenantAttributeType,
  TenantFeature,
  TenantFeatureCertifier,
  TenantFeatureDelegatedConsumer,
  TenantFeatureDelegatedProducer,
  TenantFeatureType,
  tenantFeatureType,
  TenantId,
  TenantKind,
  TenantMail,
  TenantMailKind,
  TenantRevoker,
  TenantUnitType,
  TenantVerifier,
  unsafeBrandId,
  VerifiedTenantAttribute,
  WithMetadata,
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
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

export const aggregateTenant = ({
  tenantSQL,
  mailsSQL,
  certifiedAttributesSQL,
  declaredAttributesSQL,
  verifiedAttributesSQL,
  verifiedAttributeVerifiersSQL,
  verifiedAttributeRevokersSQL,
  featuresSQL,
}: TenantItemsSQL): WithMetadata<Tenant> => {
  const mails = mailsSQL.map(tenantMailSQLToTenantMail);

  const attributes = aggregateTenantAttributes({
    certifiedAttributesSQL,
    declaredAttributesSQL,
    verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL,
  });

  const features: TenantFeature[] = featuresSQL.map((feature) =>
    match(TenantFeatureType.parse(feature.kind))
      .with(tenantFeatureType.persistentCertifier, () => {
        if (!feature.certifierId) {
          throw genericInternalError(
            "certifierId can't be missing in certifier feature"
          );
        }
        return {
          type: tenantFeatureType.persistentCertifier,
          certifierId: feature.certifierId,
        } satisfies TenantFeatureCertifier;
      })
      .with(tenantFeatureType.delegatedProducer, () => {
        if (!feature.availabilityTimestamp) {
          throw genericInternalError(
            "availabilityTimestamp can't be missing in delegatedProducer feature"
          );
        }
        return {
          type: tenantFeatureType.delegatedProducer,
          availabilityTimestamp: stringToDate(feature.availabilityTimestamp),
        } satisfies TenantFeatureDelegatedProducer;
      })
      .with(tenantFeatureType.delegatedConsumer, () => {
        if (!feature.availabilityTimestamp) {
          throw genericInternalError(
            "availabilityTimestamp can't be missing in delegatedConsumer feature"
          );
        }
        return {
          type: tenantFeatureType.delegatedConsumer,
          availabilityTimestamp: stringToDate(feature.availabilityTimestamp),
        } satisfies TenantFeatureDelegatedConsumer;
      })
      .exhaustive()
  );

  const tenant: Tenant = {
    id: unsafeBrandId(tenantSQL.id),
    name: tenantSQL.name,
    ...(tenantSQL.kind ? { kind: TenantKind.parse(tenantSQL.kind) } : {}),
    createdAt: stringToDate(tenantSQL.createdAt),
    ...(tenantSQL.onboardedAt
      ? { onboardedAt: stringToDate(tenantSQL.onboardedAt) }
      : {}),
    ...(tenantSQL.updatedAt
      ? { updatedAt: stringToDate(tenantSQL.updatedAt) }
      : {}),
    ...(tenantSQL.selfcareId ? { selfcareId: tenantSQL.selfcareId } : {}),
    ...(tenantSQL.subUnitType
      ? { subUnitType: TenantUnitType.parse(tenantSQL.subUnitType) }
      : {}),
    attributes,
    externalId: {
      origin: tenantSQL.externalIdOrigin,
      value: tenantSQL.externalIdValue,
    },
    features,
    mails,
  };
  return {
    data: tenant,
    metadata: {
      version: tenantSQL.metadataVersion,
    },
  };
};

export const aggregateTenantArray = ({
  tenantsSQL,
  mailsSQL,
  certifiedAttributesSQL,
  declaredAttributesSQL,
  verifiedAttributesSQL,
  verifiedAttributeVerifiersSQL,
  verifiedAttributeRevokersSQL,
  featuresSQL,
}: {
  tenantsSQL: TenantSQL[];
  mailsSQL: TenantMailSQL[];
  certifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  declaredAttributesSQL: TenantDeclaredAttributeSQL[];
  verifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  verifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  verifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
  featuresSQL: TenantFeatureSQL[];
}): Array<WithMetadata<Tenant>> => {
  const mailsSQLByTenantId = createTenantSQLPropertyMap(mailsSQL);
  const certifiedAttributesSQLByTenantId = createTenantSQLPropertyMap(
    certifiedAttributesSQL
  );
  const declaredAttributesSQLByTenantId = createTenantSQLPropertyMap(
    declaredAttributesSQL
  );
  const verifiedAttributesSQLByTenantId = createTenantSQLPropertyMap(
    verifiedAttributesSQL
  );
  const verifiedAttributeVerifiersSQLByTenantId = createTenantSQLPropertyMap(
    verifiedAttributeVerifiersSQL
  );
  const verifiedAttributeRevokersSQLByTenantId = createTenantSQLPropertyMap(
    verifiedAttributeRevokersSQL
  );
  const featuresSQLByTenantId = createTenantSQLPropertyMap(featuresSQL);

  return tenantsSQL.map((tenantSQL) => {
    const tenantId = unsafeBrandId<TenantId>(tenantSQL.id);
    return aggregateTenant({
      tenantSQL,
      mailsSQL: mailsSQLByTenantId.get(tenantId) || [],
      certifiedAttributesSQL:
        certifiedAttributesSQLByTenantId.get(tenantId) || [],
      declaredAttributesSQL:
        declaredAttributesSQLByTenantId.get(tenantId) || [],
      verifiedAttributesSQL:
        verifiedAttributesSQLByTenantId.get(tenantId) || [],
      verifiedAttributeVerifiersSQL:
        verifiedAttributeVerifiersSQLByTenantId.get(tenantId) || [],
      verifiedAttributeRevokersSQL:
        verifiedAttributeRevokersSQLByTenantId.get(tenantId) || [],
      featuresSQL: featuresSQLByTenantId.get(tenantId) || [],
    });
  });
};

const createTenantSQLPropertyMap = <
  T extends
    | TenantMailSQL
    | TenantCertifiedAttributeSQL
    | TenantDeclaredAttributeSQL
    | TenantVerifiedAttributeSQL
    | TenantVerifiedAttributeVerifierSQL
    | TenantVerifiedAttributeRevokerSQL
    | TenantFeatureSQL,
>(
  items: T[]
): Map<TenantId, T[]> =>
  items.reduce((acc, item) => {
    const tenantId = unsafeBrandId<TenantId>(item.tenantId);
    const values = acc.get(tenantId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(tenantId, values);

    return acc;
  }, new Map<TenantId, T[]>());

const createTenantVerifiedAttributeSQLPropertyMap = <
  T extends
    | TenantVerifiedAttributeVerifierSQL
    | TenantVerifiedAttributeRevokerSQL,
>(
  items: T[]
): Map<AttributeId, T[]> =>
  items.reduce((acc, item) => {
    const attributeId = unsafeBrandId<AttributeId>(
      item.tenantVerifiedAttributeId
    );
    const values = acc.get(attributeId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(attributeId, values);

    return acc;
  }, new Map<AttributeId, T[]>());

const tenantMailSQLToTenantMail = (mail: TenantMailSQL): TenantMail => ({
  id: mail.id,
  createdAt: stringToDate(mail.createdAt),
  ...(mail.description ? { description: mail.description } : {}),
  kind: TenantMailKind.parse(mail.kind),
  address: mail.address,
});

const aggregateTenantAttributes = ({
  certifiedAttributesSQL,
  declaredAttributesSQL,
  verifiedAttributesSQL,
  verifiedAttributeVerifiersSQL,
  verifiedAttributeRevokersSQL,
}: {
  certifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  declaredAttributesSQL: TenantDeclaredAttributeSQL[];
  verifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  verifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  verifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
}): TenantAttribute[] => {
  const certifiedTenantAttributes: CertifiedTenantAttribute[] =
    certifiedAttributesSQL.map((certifiedAttributeSQL) => ({
      id: unsafeBrandId(certifiedAttributeSQL.attributeId),
      type: tenantAttributeType.CERTIFIED,
      assignmentTimestamp: stringToDate(
        certifiedAttributeSQL.assignmentTimestamp
      ),
      ...(certifiedAttributeSQL.revocationTimestamp
        ? {
            revocationTimestamp: stringToDate(
              certifiedAttributeSQL.revocationTimestamp
            ),
          }
        : {}),
    }));

  const declaredTenantAttributes: DeclaredTenantAttribute[] =
    declaredAttributesSQL.map((declaredAttributeSQL) => ({
      id: unsafeBrandId(declaredAttributeSQL.attributeId),
      type: tenantAttributeType.DECLARED,
      assignmentTimestamp: stringToDate(
        declaredAttributeSQL.assignmentTimestamp
      ),
      ...(declaredAttributeSQL.revocationTimestamp
        ? {
            revocationTimestamp: stringToDate(
              declaredAttributeSQL.revocationTimestamp
            ),
          }
        : {}),
      ...(declaredAttributeSQL.delegationId
        ? {
            delegationId: unsafeBrandId<DelegationId>(
              declaredAttributeSQL.delegationId
            ),
          }
        : {}),
    }));

  const verifiedAttributeVerifiersSQLByAttributeId =
    createTenantVerifiedAttributeSQLPropertyMap(verifiedAttributeVerifiersSQL);
  const verifiedAttributeRevokersSQLByAttributeId =
    createTenantVerifiedAttributeSQLPropertyMap(verifiedAttributeRevokersSQL);
  const verifiedTenantAttributes: VerifiedTenantAttribute[] =
    verifiedAttributesSQL.map((currentVerifiedAttributeSQL) => {
      const attributeId = unsafeBrandId<AttributeId>(
        currentVerifiedAttributeSQL.attributeId
      );
      const verifiersSQLOfCurrentAttribute =
        verifiedAttributeVerifiersSQLByAttributeId.get(attributeId) || [];

      const verifiersOfCurrentAttribute: TenantVerifier[] =
        verifiersSQLOfCurrentAttribute.map((tenantVerifierSQL) => ({
          id: unsafeBrandId(tenantVerifierSQL.tenantVerifierId),
          verificationDate: stringToDate(tenantVerifierSQL.verificationDate),
          ...(tenantVerifierSQL.expirationDate
            ? {
                expirationDate: stringToDate(tenantVerifierSQL.expirationDate),
              }
            : {}),
          ...(tenantVerifierSQL.extensionDate
            ? {
                extensionDate: stringToDate(tenantVerifierSQL.extensionDate),
              }
            : {}),
          ...(tenantVerifierSQL.delegationId
            ? {
                delegationId: unsafeBrandId<DelegationId>(
                  tenantVerifierSQL.delegationId
                ),
              }
            : {}),
        }));

      const revokersSQLOfCurrentAttribute =
        verifiedAttributeRevokersSQLByAttributeId.get(attributeId) || [];
      const revokersOfCurrentAttribute: TenantRevoker[] =
        revokersSQLOfCurrentAttribute.map((tenantRevokerSQL) => ({
          id: unsafeBrandId(tenantRevokerSQL.tenantRevokerId),
          verificationDate: stringToDate(tenantRevokerSQL.verificationDate),
          ...(tenantRevokerSQL.expirationDate
            ? {
                expirationDate: stringToDate(tenantRevokerSQL.expirationDate),
              }
            : {}),
          ...(tenantRevokerSQL.extensionDate
            ? {
                extensionDate: stringToDate(tenantRevokerSQL.extensionDate),
              }
            : {}),
          revocationDate: stringToDate(tenantRevokerSQL.revocationDate),
          ...(tenantRevokerSQL.delegationId
            ? {
                delegationId: unsafeBrandId<DelegationId>(
                  tenantRevokerSQL.delegationId
                ),
              }
            : {}),
        }));

      return {
        id: unsafeBrandId(currentVerifiedAttributeSQL.attributeId),
        type: tenantAttributeType.VERIFIED,
        assignmentTimestamp: stringToDate(
          currentVerifiedAttributeSQL.assignmentTimestamp
        ),
        verifiedBy: verifiersOfCurrentAttribute,
        revokedBy: revokersOfCurrentAttribute,
      };
    });

  return [
    ...certifiedTenantAttributes,
    ...declaredTenantAttributes,
    ...verifiedTenantAttributes,
  ];
};

export const toTenantAggregator = (
  queryRes: Array<{
    tenant: TenantSQL;
    mail: TenantMailSQL | null;
    certifiedAttribute: TenantCertifiedAttributeSQL | null;
    declaredAttribute: TenantDeclaredAttributeSQL | null;
    verifiedAttribute: TenantVerifiedAttributeSQL | null;
    verifier: TenantVerifiedAttributeVerifierSQL | null;
    revoker: TenantVerifiedAttributeRevokerSQL | null;
    feature: TenantFeatureSQL | null;
  }>
): TenantItemsSQL => {
  const {
    tenantsSQL,
    mailsSQL,
    certifiedAttributesSQL,
    declaredAttributesSQL,
    verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL,
    featuresSQL,
  } = toTenantAggregatorArray(queryRes);

  throwIfMultiple(tenantsSQL, "tenant");

  return {
    tenantSQL: tenantsSQL[0],
    mailsSQL,
    certifiedAttributesSQL,
    declaredAttributesSQL,
    verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL,
    featuresSQL,
  };
};

export const toTenantAggregatorArray = (
  queryRes: Array<{
    tenant: TenantSQL;
    mail: TenantMailSQL | null;
    certifiedAttribute: TenantCertifiedAttributeSQL | null;
    declaredAttribute: TenantDeclaredAttributeSQL | null;
    verifiedAttribute: TenantVerifiedAttributeSQL | null;
    verifier: TenantVerifiedAttributeVerifierSQL | null;
    revoker: TenantVerifiedAttributeRevokerSQL | null;
    feature: TenantFeatureSQL | null;
  }>
): {
  tenantsSQL: TenantSQL[];
  mailsSQL: TenantMailSQL[];
  certifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  declaredAttributesSQL: TenantDeclaredAttributeSQL[];
  verifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  verifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  verifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
  featuresSQL: TenantFeatureSQL[];
} => {
  const tenantIdSet = new Set<string>();
  const tenantsSQL: TenantSQL[] = [];

  const mailIdSet = new Set<string>();
  const mailsSQL: TenantMailSQL[] = [];

  const certifiedAttributeIdSet = new Set<string>();
  const certifiedAttributesSQL: TenantCertifiedAttributeSQL[] = [];

  const declaredAttributeIdSet = new Set<string>();
  const declaredAttributesSQL: TenantDeclaredAttributeSQL[] = [];

  const verifiedAttributeIdSet = new Set<string>();
  const verifiedAttributesSQL: TenantVerifiedAttributeSQL[] = [];

  const verifiersIdSet = new Set<string>();
  const verifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[] =
    [];

  const revokersIdSet = new Set<string>();
  const verifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[] = [];

  const featureIdSet = new Set<string>();
  const featuresSQL: TenantFeatureSQL[] = [];

  // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
  queryRes.forEach((row) => {
    const tenantSQL = row.tenant;
    if (!tenantIdSet.has(tenantSQL.id)) {
      tenantIdSet.add(tenantSQL.id);
      // eslint-disable-next-line functional/immutable-data
      tenantsSQL.push(tenantSQL);
    }

    const mailSQL = row.mail;
    const mailPK = mailSQL
      ? makeUniqueKey([mailSQL.id, mailSQL.tenantId, mailSQL.createdAt])
      : undefined;
    if (mailSQL && mailPK && !mailIdSet.has(mailPK)) {
      mailIdSet.add(mailPK);
      // eslint-disable-next-line functional/immutable-data
      mailsSQL.push(mailSQL);
    }

    const certifiedAttributeSQL = row.certifiedAttribute;
    const certifiedAttributePK = certifiedAttributeSQL
      ? makeUniqueKey([
          certifiedAttributeSQL.attributeId,
          certifiedAttributeSQL.tenantId,
        ])
      : undefined;
    if (
      certifiedAttributeSQL &&
      certifiedAttributePK &&
      !certifiedAttributeIdSet.has(certifiedAttributePK)
    ) {
      certifiedAttributeIdSet.add(certifiedAttributePK);
      // eslint-disable-next-line functional/immutable-data
      certifiedAttributesSQL.push(certifiedAttributeSQL);
    }

    const declaredAttributeSQL = row.declaredAttribute;
    const declaredAttributePK = declaredAttributeSQL
      ? makeUniqueKey([
          declaredAttributeSQL.attributeId,
          declaredAttributeSQL.tenantId,
        ])
      : undefined;
    if (
      declaredAttributeSQL &&
      declaredAttributePK &&
      !declaredAttributeIdSet.has(declaredAttributePK)
    ) {
      declaredAttributeIdSet.add(declaredAttributePK);
      // eslint-disable-next-line functional/immutable-data
      declaredAttributesSQL.push(declaredAttributeSQL);
    }

    const verifiedAttributeSQL = row.verifiedAttribute;
    if (verifiedAttributeSQL) {
      const verifiedAttributePK = makeUniqueKey([
        verifiedAttributeSQL.attributeId,
        verifiedAttributeSQL.tenantId,
      ]);
      if (!verifiedAttributeIdSet.has(verifiedAttributePK)) {
        verifiedAttributeIdSet.add(verifiedAttributePK);
        // eslint-disable-next-line functional/immutable-data
        verifiedAttributesSQL.push(verifiedAttributeSQL);
      }

      const verifier = row.verifier;
      const verifierPK = verifier
        ? makeUniqueKey([
            verifier.tenantId,
            verifier.tenantVerifiedAttributeId,
            verifier.tenantVerifierId,
            verifier.delegationId || "",
            verifier.verificationDate,
            verifier.expirationDate || "",
            verifier.extensionDate || "",
          ])
        : undefined;
      if (verifier && verifierPK && !verifiersIdSet.has(verifierPK)) {
        verifiersIdSet.add(verifierPK);
        // eslint-disable-next-line functional/immutable-data
        verifiedAttributeVerifiersSQL.push(verifier);
      }

      const revoker = row.revoker;
      const revokerPK = revoker
        ? makeUniqueKey([
            revoker.tenantId,
            revoker.tenantVerifiedAttributeId,
            revoker.tenantRevokerId,
            revoker.delegationId || "",
            revoker.revocationDate,
            revoker.verificationDate,
            revoker.expirationDate || "",
            revoker.extensionDate || "",
          ])
        : undefined;
      if (revoker && revokerPK && !revokersIdSet.has(revokerPK)) {
        revokersIdSet.add(revokerPK);
        // eslint-disable-next-line functional/immutable-data
        verifiedAttributeRevokersSQL.push(revoker);
      }
    }

    const feature = row.feature;
    const featurePK = feature
      ? makeUniqueKey([feature.tenantId, feature.kind])
      : undefined;
    if (feature && featurePK && !featureIdSet.has(featurePK)) {
      featureIdSet.add(featurePK);
      // eslint-disable-next-line functional/immutable-data
      featuresSQL.push(feature);
    }
  });

  return {
    tenantsSQL,
    mailsSQL,
    certifiedAttributesSQL,
    declaredAttributesSQL,
    verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL,
    featuresSQL,
  };
};
