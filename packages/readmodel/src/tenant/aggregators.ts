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

export const aggregateTenantSQL = ({
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
    match(feature.kind)
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
      .otherwise(() => {
        throw genericInternalError("Unexpected tenant feature");
      })
  );

  const tenant: Tenant = {
    id: unsafeBrandId<TenantId>(tenantSQL.id),
    name: tenantSQL.name,
    kind: tenantSQL.kind ? TenantKind.parse(tenantSQL.kind) : undefined,
    createdAt: stringToDate(tenantSQL.createdAt),
    onboardedAt: stringToDate(tenantSQL.onboardedAt),
    updatedAt: stringToDate(tenantSQL.updatedAt),
    selfcareId: tenantSQL.selfcareId || undefined,
    subUnitType: tenantSQL.subUnitType
      ? TenantUnitType.parse(tenantSQL.subUnitType)
      : undefined,
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
  tenantsSQL.map((tenantSQL) => {
    const mailsSQLOfCurrentTenant = mailsSQL.filter(
      (mailSQL) => mailSQL.tenantId === tenantSQL.id
    );

    const certifiedAttributesSQLOfCurrentTenant = certifiedAttributesSQL.filter(
      (attr) => attr.tenantId === tenantSQL.id
    );

    const declaredAttributesSQLOfCurrentTenant = declaredAttributesSQL.filter(
      (attr) => attr.tenantId === tenantSQL.id
    );

    const verifiedAttributesSQLOfCurrentTenant = verifiedAttributesSQL.filter(
      (attr) => attr.tenantId === tenantSQL.id
    );

    const verifiersSQLOfCurrentTenant = verifiedAttributeVerifiersSQL.filter(
      (verifier) => verifier.tenantId === tenantSQL.id
    );

    const revokersSQLOfCurrentTenant = verifiedAttributeRevokersSQL.filter(
      (revoker) => revoker.tenantId === tenantSQL.id
    );

    const feautesSQLOfCurrentTenant = featuresSQL.filter(
      (feature) => feature.tenantId === tenantSQL.id
    );

    return aggregateTenantSQL({
      tenantSQL,
      mailsSQL: mailsSQLOfCurrentTenant,
      certifiedAttributesSQL: certifiedAttributesSQLOfCurrentTenant,
      declaredAttributesSQL: declaredAttributesSQLOfCurrentTenant,
      verifiedAttributesSQL: verifiedAttributesSQLOfCurrentTenant,
      verifiedAttributeVerifiersSQL: verifiersSQLOfCurrentTenant,
      verifiedAttributeRevokersSQL: revokersSQLOfCurrentTenant,
      featuresSQL: feautesSQLOfCurrentTenant,
    });
  });

const tenantMailSQLToTenantMail = (mail: TenantMailSQL): TenantMail => ({
  id: mail.id,
  createdAt: stringToDate(mail.createdAt),
  description: mail.description || undefined,
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
      id: unsafeBrandId<AttributeId>(certifiedAttributeSQL.attributeId),
      type: tenantAttributeType.CERTIFIED,
      assignmentTimestamp: stringToDate(
        certifiedAttributeSQL.assignmentTimestamp
      ),
      revocationTimestamp: stringToDate(
        certifiedAttributeSQL.revocationTimestamp
      ),
    }));

  const declaredTenantAttributes: DeclaredTenantAttribute[] =
    declaredAttributesSQL.map((declaredAttributeSQL) => ({
      id: unsafeBrandId<AttributeId>(declaredAttributeSQL.attributeId),
      type: tenantAttributeType.DECLARED,
      assignmentTimestamp: stringToDate(
        declaredAttributeSQL.assignmentTimestamp
      ),
      revocationTimestamp: stringToDate(
        declaredAttributeSQL.revocationTimestamp
      ),
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
            id: unsafeBrandId<TenantId>(tenantVerifierSQL.tenantVerifierId),
            verificationDate: stringToDate(tenantVerifierSQL.verificationDate),
            expirationDate: stringToDate(tenantVerifierSQL.expirationDate),
            extensionDate: stringToDate(tenantVerifierSQL.extensionDate),
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
            id: unsafeBrandId<TenantId>(tenantRevokerSQL.tenantRevokerId),
            verificationDate: stringToDate(tenantRevokerSQL.verificationDate),
            expirationDate: stringToDate(tenantRevokerSQL.expirationDate),
            extensionDate: stringToDate(tenantRevokerSQL.extensionDate),
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
        id: unsafeBrandId<AttributeId>(currentVerifiedAttributeSQL.attributeId),
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
