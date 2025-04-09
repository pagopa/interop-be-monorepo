import {
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
}): Array<WithMetadata<Tenant>> =>
  tenantsSQL.map((tenantSQL) =>
    aggregateTenant({
      tenantSQL,
      mailsSQL: mailsSQL.filter((mailSQL) => mailSQL.tenantId === tenantSQL.id),
      certifiedAttributesSQL: certifiedAttributesSQL.filter(
        (attr) => attr.tenantId === tenantSQL.id
      ),
      declaredAttributesSQL: declaredAttributesSQL.filter(
        (attr) => attr.tenantId === tenantSQL.id
      ),
      verifiedAttributesSQL: verifiedAttributesSQL.filter(
        (attr) => attr.tenantId === tenantSQL.id
      ),
      verifiedAttributeVerifiersSQL: verifiedAttributeVerifiersSQL.filter(
        (verifier) => verifier.tenantId === tenantSQL.id
      ),
      verifiedAttributeRevokersSQL: verifiedAttributeRevokersSQL.filter(
        (revoker) => revoker.tenantId === tenantSQL.id
      ),
      featuresSQL: featuresSQL.filter(
        (feature) => feature.tenantId === tenantSQL.id
      ),
    })
  );

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

  const verifiedTenantAttributes: VerifiedTenantAttribute[] =
    verifiedAttributesSQL.map((currentVerifiedAttributeSQL) => {
      const verifiersOfCurrentAttribute: TenantVerifier[] =
        verifiedAttributeVerifiersSQL
          .filter(
            (attr) =>
              attr.tenantVerifiedAttributeId ===
              currentVerifiedAttributeSQL.attributeId
          )
          .map((tenantVerifierSQL) => ({
            id: unsafeBrandId(tenantVerifierSQL.tenantVerifierId),
            verificationDate: stringToDate(tenantVerifierSQL.verificationDate),
            ...(tenantVerifierSQL.expirationDate
              ? {
                  expirationDate: stringToDate(
                    tenantVerifierSQL.expirationDate
                  ),
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

      const revokersOfCurrentAttribute: TenantRevoker[] =
        verifiedAttributeRevokersSQL
          .filter(
            (attr) =>
              attr.tenantVerifiedAttributeId ===
              currentVerifiedAttributeSQL.attributeId
          )
          .map((tenantRevokerSQL) => ({
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
