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
  TenantFeatureDelegatedProducer,
  tenantFeatureType,
  TenantId,
  TenantMail,
  TenantMailKind,
  TenantRevoker,
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
  TenantMailSQL,
  TenantSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
} from "../types.js";

export const aggregateTenantSQL = ({
  tenantSQL,
  tenantMailsSQL,
  tenantCertifiedAttributesSQL,
  tenantDeclaredAttributesSQL,
  tenantVerifiedAttributesSQL,
  tenantVerifiedAttributeVerifiersSQL,
  tenantVerifiedAttributeRevokersSQL,
  tenantFeaturesSQL,
}: {
  tenantSQL: TenantSQL;
  tenantMailsSQL: TenantMailSQL[];
  tenantCertifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  tenantDeclaredAttributesSQL: TenantDeclaredAttributeSQL[];
  tenantVerifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  tenantVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  tenantVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
  tenantFeaturesSQL: TenantFeatureSQL[];
}): WithMetadata<Tenant> => {
  const mails = tenantMailsSQL.map(tenantMailSQLToTenantMail);

  const attributes = aggregateTenantAttributes({
    tenantCertifiedAttributesSQL,
    tenantDeclaredAttributesSQL,
    tenantVerifiedAttributesSQL,
    tenantVerifiedAttributeVerifiersSQL,
    tenantVerifiedAttributeRevokersSQL,
  });

  const features: TenantFeature[] = tenantFeaturesSQL.map((feature) =>
    match(feature.kind)
      .with(tenantFeatureType.persistentCertifier, () => {
        const res = TenantFeatureCertifier.omit({ type: true }).safeParse(
          feature.details
        );

        if (res.success) {
          const featurePayload = res.data;
          return {
            type: tenantFeatureType.persistentCertifier,
            ...featurePayload,
          };
        }
        throw genericInternalError("Unexpected tenant feature details");
      })
      .with(tenantFeatureType.delegatedProducer, () => {
        const res = TenantFeatureDelegatedProducer.omit({
          type: true,
        }).safeParse(feature.details);

        if (res.success) {
          return {
            type: tenantFeatureType.delegatedProducer,
            ...res.data, // NOTE: date conversion is already handled in the safeParse above
          };
        }
        throw genericInternalError("Unexpected tenant feature details");
      })
      .with(tenantFeatureType.delegatedConsumer, () => {
        const res = TenantFeatureDelegatedProducer.omit({
          type: true,
        }).safeParse(feature.details);

        if (res.success) {
          return {
            type: tenantFeatureType.delegatedConsumer,
            ...res.data, // NOTE: date conversion is already handled in the safeParse above
          };
        }
        throw genericInternalError("Unexpected tenant feature details");
      })
      .otherwise(() => {
        throw genericInternalError("Unexpected tenant feature");
      })
  );

  const tenant: Tenant = {
    id: unsafeBrandId<TenantId>(tenantSQL.id),
    name: tenantSQL.name,
    createdAt: stringToDate(tenantSQL.createdAt),
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
      version: 1,
    },
  };
};

const tenantMailSQLToTenantMail = (mail: TenantMailSQL): TenantMail => ({
  id: mail.id,
  createdAt: stringToDate(mail.createdAt),
  kind: TenantMailKind.parse(mail.kind),
  address: mail.address,
});

const aggregateTenantAttributes = ({
  tenantCertifiedAttributesSQL,
  tenantDeclaredAttributesSQL,
  tenantVerifiedAttributesSQL,
  tenantVerifiedAttributeVerifiersSQL,
  tenantVerifiedAttributeRevokersSQL,
}: {
  tenantCertifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  tenantDeclaredAttributesSQL: TenantDeclaredAttributeSQL[];
  tenantVerifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  tenantVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  tenantVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
}): TenantAttribute[] => {
  const certifiedTenantAttributes: CertifiedTenantAttribute[] =
    tenantCertifiedAttributesSQL.map((certifiedAttributeSQL) => ({
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
    tenantDeclaredAttributesSQL.map((declaredAttributeSQL) => ({
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
    tenantVerifiedAttributesSQL.map((currentVerifiedAttributeSQL) => {
      const verifiersOfCurrentAttribute: TenantVerifier[] =
        tenantVerifiedAttributeVerifiersSQL
          .filter((attr) => attr.id === currentVerifiedAttributeSQL.attributeId)
          .map((tenantVerifierSQL) => ({
            id: unsafeBrandId<TenantId>(tenantVerifierSQL.id),
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
        tenantVerifiedAttributeRevokersSQL
          .filter((attr) => attr.id === currentVerifiedAttributeSQL.attributeId)
          .map((tenantRevokerSQL) => ({
            id: unsafeBrandId<TenantId>(tenantRevokerSQL.id),
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
