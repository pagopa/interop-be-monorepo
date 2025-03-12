/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockTenant,
  getMockTenantMail,
  getMockVerifiedTenantAttribute,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  TenantSQL,
  TenantMailSQL,
  TenantFeatureSQL,
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
} from "pagopa-interop-readmodel-models";
import {
  AttributeId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  DelegationId,
  ExternalId,
  generateId,
  stringToDate,
  Tenant,
  TenantAttribute,
  tenantAttributeType,
  TenantFeature,
  TenantFeatureCertifier,
  TenantFeatureDelegatedConsumer,
  TenantFeatureDelegatedProducer,
  tenantFeatureType,
  tenantKind,
  TenantMail,
  TenantRevoker,
  tenantUnitType,
  TenantVerifier,
  VerifiedTenantAttribute,
  WithMetadata,
} from "pagopa-interop-models";

import { tenantReadModelServiceBuilder } from "../src/tenantReadModelService.js";
import {
  retrieveTenantSQL,
  retrieveTenantMailsSQL,
  retrieveTenantCertifiedAttributesSQL,
  retrieveTenantDeclaredAttributesSQL,
  retrieveTenantVerifiedAttributesSQL,
  retrieveTenantVerifiedAttributeVerifiersSQL,
  retrieveTenantVerifiedAttributeRevokersSQL,
  retrieveTenanFeaturesSQL,
} from "./tenantTestReadModelService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(async () => {
  /*
  TODO the entries in tenant_verified_attribute_verifier and tenant_verified_attribute_revoker have a reference on the tenant table,
  but this reference donesn't have on delete cascade. During the cleanup of the test, those entries block the deletion of tenants (for example the verifier) from the tenant table because they are still referred.
  This problem could be fixed if we add ON DELETE CASCADE but I am not sure if that could bring to an unwanted behavior
*/
  await readModelDB.delete(tenantVerifiedAttributeVerifierInReadmodelTenant);
  await readModelDB.delete(tenantVerifiedAttributeRevokerInReadmodelTenant);

  await cleanup();
});

export const tenantReadModelService =
  tenantReadModelServiceBuilder(readModelDB);

export const initMockTenant = (
  isTenantComplete: boolean
): {
  tenantBeforeUpdate: WithMetadata<Tenant>;
  tenant: WithMetadata<Tenant>;
  tenantForVerifying: WithMetadata<Tenant>;
  tenantForRevoking: WithMetadata<Tenant>;
  tenantMails: TenantMail[];
  tenantCertifiedAttribute: CertifiedTenantAttribute;
  tenantDeclaredAttribute: DeclaredTenantAttribute;
  tenantVerifiedAttribute: VerifiedTenantAttribute;
  tenantVerifier: TenantVerifier;
  tenantRevoker: TenantRevoker;
  tenantFeatureCertifier: TenantFeatureCertifier;
  tenantFeatureDelegatedConsumer: TenantFeatureDelegatedConsumer;
  tenantFeatureDelegatedProducer: TenantFeatureDelegatedProducer;
} => {
  const tenantForVerifying: WithMetadata<Tenant> = {
    data: {
      ...getMockTenant(),
    },
    metadata: { version: 1 },
  };
  const tenantForRevoking: WithMetadata<Tenant> = {
    data: {
      ...getMockTenant(),
    },
    metadata: { version: 1 },
  };
  const delegationId = generateId<DelegationId>();
  const tenantVerifier: TenantVerifier = {
    id: tenantForVerifying.data.id,
    verificationDate: new Date(),
    ...(isTenantComplete
      ? {
          expirationDate: new Date(),
          extensionDate: new Date(),
          delegationId,
        }
      : {}),
  };
  const tenantRevoker: TenantRevoker = {
    id: tenantForRevoking.data.id,
    verificationDate: new Date(),
    revocationDate: new Date(),
    ...(isTenantComplete
      ? {
          expirationDate: new Date(),
          extensionDate: new Date(),
          delegationId,
        }
      : {}),
  };

  const tenantMails: TenantMail[] = [
    {
      ...getMockTenantMail(),
      ...(isTenantComplete
        ? {
            description: "mail description",
          }
        : {}),
    },
  ];
  const tenantCertifiedAttribute: CertifiedTenantAttribute = {
    id: generateId<AttributeId>(),
    type: tenantAttributeType.CERTIFIED,
    assignmentTimestamp: new Date(),
    ...(isTenantComplete
      ? {
          revocationTimestamp: new Date(),
        }
      : {}),
  };

  const tenantDeclaredAttribute: DeclaredTenantAttribute = {
    id: generateId<AttributeId>(),
    type: tenantAttributeType.DECLARED,
    assignmentTimestamp: new Date(),
    ...(isTenantComplete
      ? {
          revocationTimestamp: new Date(),
          delegationId,
        }
      : {}),
  };

  const tenantVerifiedAttribute: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [tenantVerifier],
    revokedBy: [tenantRevoker],
    assignmentTimestamp: new Date(),
  };

  const tenantFeatureCertifier: TenantFeatureCertifier = {
    type: tenantFeatureType.persistentCertifier,
    certifierId: generateId(),
  };

  const tenantFeatureDelegatedConsumer: TenantFeatureDelegatedConsumer = {
    type: tenantFeatureType.delegatedConsumer,
    availabilityTimestamp: new Date(),
  };

  const tenantFeatureDelegatedProducer: TenantFeatureDelegatedProducer = {
    type: tenantFeatureType.delegatedProducer,
    availabilityTimestamp: new Date(),
  };

  const selfcareId = generateId();

  const externalId: ExternalId = {
    origin: "IPA",
    value: generateId(),
  };
  const tenantBeforeUpdate: WithMetadata<Tenant> = {
    data: {
      ...getMockTenant(),
    },
    metadata: {
      version: 1,
    },
  };
  const tenant: WithMetadata<Tenant> = {
    ...tenantBeforeUpdate,
    data: {
      ...tenantBeforeUpdate.data,
      externalId,
      mails: tenantMails,
      attributes: [
        tenantCertifiedAttribute,
        tenantDeclaredAttribute,
        tenantVerifiedAttribute,
      ],
      features: [
        tenantFeatureDelegatedProducer,
        tenantFeatureDelegatedConsumer,
        tenantFeatureCertifier,
      ],
      ...(isTenantComplete
        ? {
            kind: tenantKind.PA,
            selfcareId,
            updatedAt: new Date(),
            onboardedAt: new Date(),
            subUnitType: tenantUnitType.AOO,
          }
        : {}),
    },
  };
  if (!isTenantComplete) {
    // eslint-disable-next-line fp/no-delete
    delete tenant.data.onboardedAt;
  }

  return {
    tenantBeforeUpdate,
    tenant,
    tenantForVerifying,
    tenantForRevoking,
    tenantMails,
    tenantCertifiedAttribute,
    tenantDeclaredAttribute,
    tenantVerifiedAttribute,
    tenantVerifier,
    tenantRevoker,
    tenantFeatureCertifier,
    tenantFeatureDelegatedConsumer,
    tenantFeatureDelegatedProducer,
  };
};

export const retrieveTenantSQLObjects = async (
  tenant: WithMetadata<Tenant>,
  isTenantComplete: boolean
): Promise<{
  retrievedTenantSQL: TenantSQL | undefined;
  retrievedMailsSQL: TenantMailSQL[] | undefined;
  retrievedCertifiedAttributesSQL: TenantCertifiedAttributeSQL[] | undefined;
  retrievedDeclaredAttributesSQL: TenantDeclaredAttributeSQL[] | undefined;
  retrievedVerifiedAttributesSQL: TenantVerifiedAttributeSQL[] | undefined;
  retrievedVerifiedAttributeVerifiersSQL:
    | TenantVerifiedAttributeVerifierSQL[]
    | undefined;
  retrievedVerifiedAttributeRevokersSQL:
    | TenantVerifiedAttributeRevokerSQL[]
    | undefined;
  retrievedFeaturesSQL: TenantFeatureSQL[] | undefined;
}> => {
  const retrievedTenantSQL = await retrieveTenantSQL(
    tenant.data.id,
    readModelDB
  );
  const retrievedAndFormattedTenantSQL = retrievedTenantSQL
    ? {
        ...retrievedTenantSQL,
        createdAt: stringToISOString(retrievedTenantSQL.createdAt),
        ...(isTenantComplete
          ? {
              kind: retrievedTenantSQL.kind,
              selfcareId: retrievedTenantSQL.selfcareId,
              subUnitType: retrievedTenantSQL.subUnitType,
              updatedAt: stringToISOString(retrievedTenantSQL.updatedAt),
              onboardedAt: stringToISOString(retrievedTenantSQL.onboardedAt),
            }
          : {}),
      }
    : undefined;
  const retrievedTenantMailsSQL = await retrieveTenantMailsSQL(
    tenant.data.id,
    readModelDB
  );
  const retrievedAndFormattedTenantMailsSQL = retrievedTenantMailsSQL?.map(
    (mail) => ({ ...mail, createdAt: stringToISOString(mail.createdAt) })
  );

  const retrievedCertifiedAttributesSQL =
    await retrieveTenantCertifiedAttributesSQL(tenant.data.id, readModelDB);

  const retrievedAndFormattedCertifiedAttributesSQL =
    retrievedCertifiedAttributesSQL?.map(
      (attribute: TenantCertifiedAttributeSQL) => ({
        ...attribute,
        assignmentTimestamp: stringToISOString(attribute.assignmentTimestamp),
        ...(isTenantComplete
          ? {
              revocationTimestamp: stringToISOString(
                attribute.revocationTimestamp
              ),
            }
          : {}),
      })
    );
  const retrievedDeclaredAttributesSQL =
    await retrieveTenantDeclaredAttributesSQL(tenant.data.id, readModelDB);

  const retrievedAndFormattedDeclaredAttributesSQL =
    retrievedDeclaredAttributesSQL?.map(
      (attribute: TenantDeclaredAttributeSQL) => ({
        ...attribute,
        assignmentTimestamp: stringToISOString(attribute.assignmentTimestamp),
        ...(isTenantComplete
          ? {
              revocationTimestamp: stringToISOString(
                attribute.revocationTimestamp
              ),
              delegationId: attribute.delegationId,
            }
          : {}),
      })
    );

  const retrievedVerifiedAttributesSQL =
    await retrieveTenantVerifiedAttributesSQL(tenant.data.id, readModelDB);
  const retrievedAndFormattedverifiedAttributesSQL =
    retrievedVerifiedAttributesSQL?.map(
      (attribute: TenantVerifiedAttributeSQL) => ({
        ...attribute,
        assignmentTimestamp: stringToISOString(attribute.assignmentTimestamp),
      })
    );

  const retrievedVerifiedAttributeVerifiersSQL =
    await retrieveTenantVerifiedAttributeVerifiersSQL(
      tenant.data.id,
      readModelDB
    );

  const retrievedAndFormattedVerifiedAttributeVerifiersSQL =
    retrievedVerifiedAttributeVerifiersSQL?.map(
      (verifier: TenantVerifiedAttributeVerifierSQL) => ({
        ...verifier,
        verificationDate: stringToISOString(verifier.verificationDate),
        ...(isTenantComplete
          ? {
              expirationDate: stringToISOString(verifier.expirationDate),
              extensionDate: stringToISOString(verifier.extensionDate),
              delegationId: verifier.delegationId,
            }
          : {}),
      })
    );

  const retrievedVerifiedAttributeRevokersSQL =
    await retrieveTenantVerifiedAttributeRevokersSQL(
      tenant.data.id,
      readModelDB
    );

  const retrievedAndFormattedVerifiedAttributeRevokesSQL =
    retrievedVerifiedAttributeRevokersSQL?.map(
      (revoker: TenantVerifiedAttributeRevokerSQL) => ({
        ...revoker,
        revocationDate: stringToISOString(revoker.revocationDate),
        verificationDate: stringToISOString(revoker.verificationDate),
        ...(isTenantComplete
          ? {
              expirationDate: stringToISOString(revoker.expirationDate),
              extensionDate: stringToISOString(revoker.extensionDate),
              delegationId: revoker.delegationId,
            }
          : {}),
      })
    );

  const retrievedFeaturesSQL = await retrieveTenanFeaturesSQL(
    tenant.data.id,
    readModelDB
  );

  const retrievedAndFormattedFeaturesSQL = retrievedFeaturesSQL?.map(
    (feature: TenantFeatureSQL) => ({
      ...feature,
      availabilityTimestamp: feature.availabilityTimestamp
        ? stringToISOString(feature.availabilityTimestamp)
        : null,
      certifierId: feature.certifierId ? feature.certifierId : null,
    })
  );

  return {
    retrievedTenantSQL: retrievedAndFormattedTenantSQL,
    retrievedMailsSQL: retrievedAndFormattedTenantMailsSQL,
    retrievedCertifiedAttributesSQL:
      retrievedAndFormattedCertifiedAttributesSQL,
    retrievedDeclaredAttributesSQL: retrievedAndFormattedDeclaredAttributesSQL,
    retrievedVerifiedAttributesSQL: retrievedAndFormattedverifiedAttributesSQL,
    retrievedVerifiedAttributeVerifiersSQL:
      retrievedAndFormattedVerifiedAttributeVerifiersSQL,
    retrievedVerifiedAttributeRevokersSQL:
      retrievedAndFormattedVerifiedAttributeRevokesSQL,
    retrievedFeaturesSQL: retrievedAndFormattedFeaturesSQL,
  };
};

export const generateExpectedTenantSQLObjects = ({
  tenant,
  tenantMails,
  tenantCertifiedAttribute,
  tenantDeclaredAttribute,
  tenantVerifiedAttribute,
  tenantVerifier,
  tenantRevoker,
  tenantFeatureCertifier,
  tenantFeatureDelegatedConsumer,
  tenantFeatureDelegatedProducer,
}: {
  tenant: WithMetadata<Tenant>;
  tenantMails: TenantMail[];
  tenantCertifiedAttribute: CertifiedTenantAttribute;
  tenantDeclaredAttribute: DeclaredTenantAttribute;
  tenantVerifiedAttribute: VerifiedTenantAttribute;
  tenantVerifier: TenantVerifier;
  tenantRevoker: TenantRevoker;
  tenantFeatureCertifier: TenantFeatureCertifier;
  tenantFeatureDelegatedConsumer: TenantFeatureDelegatedConsumer;
  tenantFeatureDelegatedProducer: TenantFeatureDelegatedProducer;
}): {
  expectedTenantSQL: TenantSQL;
  expectedMailsSQL: TenantMailSQL[];
  expectedCertifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  expectedDeclaredAttributesSQL: TenantDeclaredAttributeSQL[];
  expectedVerifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  expectedVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  expectedVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
  expectedFeaturesSQL: TenantFeatureSQL[];
} => {
  const expectedTenantSQL: TenantSQL = {
    id: tenant.data.id,
    metadataVersion: tenant.metadata.version,
    kind: tenant.data.kind ? tenant.data.kind : null,
    selfcareId: tenant.data.selfcareId!,
    createdAt: tenant.data.createdAt.toISOString(),
    updatedAt: tenant.data.updatedAt?.toISOString() || null,
    name: tenant.data.name,
    onboardedAt: tenant.data.onboardedAt?.toISOString() || null,
    subUnitType: tenant.data.subUnitType ? tenant.data.subUnitType : null,
    externalIdOrigin: tenant.data.externalId.origin,
    externalIdValue: tenant.data.externalId.value,
  };

  const expectedMailsSQL: TenantMailSQL[] = tenantMails.map(
    (mail: TenantMail) => ({
      id: mail.id,
      kind: mail.kind,
      createdAt: mail.createdAt.toISOString(),
      metadataVersion: tenant.metadata.version,
      tenantId: tenant.data.id,
      address: mail.address,
      description: mail.description ? mail.description : null,
    })
  );
  const expectedCertifiedAttributesSQL: TenantCertifiedAttributeSQL[] = [
    {
      metadataVersion: tenant.metadata.version,
      tenantId: tenant.data.id,
      attributeId: tenantCertifiedAttribute.id,
      assignmentTimestamp:
        tenantCertifiedAttribute.assignmentTimestamp.toISOString(),
      revocationTimestamp:
        tenantCertifiedAttribute.revocationTimestamp?.toISOString() || null,
    },
  ];
  const expectedDeclaredAttributesSQL: TenantDeclaredAttributeSQL[] = [
    {
      tenantId: tenant.data.id,
      metadataVersion: tenant.metadata.version,
      attributeId: tenantDeclaredAttribute.id,
      assignmentTimestamp:
        tenantDeclaredAttribute.assignmentTimestamp.toISOString(),
      revocationTimestamp:
        tenantDeclaredAttribute.revocationTimestamp?.toISOString() || null,
      delegationId: tenantDeclaredAttribute.delegationId
        ? tenantDeclaredAttribute.delegationId
        : null,
    },
  ];
  const expectedVerifiedAttributesSQL: TenantVerifiedAttributeSQL[] = [
    {
      tenantId: tenant.data.id,
      metadataVersion: tenant.metadata.version,
      attributeId: tenantVerifiedAttribute.id,
      assignmentTimestamp:
        tenantVerifiedAttribute.assignmentTimestamp.toISOString(),
    },
  ];
  const expectedVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[] =
    [
      {
        tenantVerifierId: tenantVerifier.id,
        tenantId: tenant.data.id,
        metadataVersion: tenant.metadata.version,
        delegationId: tenantVerifier.delegationId
          ? tenantVerifier.delegationId
          : null,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: tenantVerifier.verificationDate.toISOString(),
        expirationDate: tenantVerifier.expirationDate?.toISOString() || null,
        extensionDate: tenantVerifier.extensionDate?.toISOString() || null,
      },
    ];
  const expectedVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[] =
    [
      {
        tenantRevokerId: tenantRevoker.id,
        tenantId: tenant.data.id,
        metadataVersion: tenant.metadata.version,
        delegationId: tenantRevoker.delegationId
          ? tenantRevoker.delegationId
          : null,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: tenantRevoker.verificationDate.toISOString(),
        expirationDate: tenantRevoker.expirationDate?.toISOString() || null,
        extensionDate: tenantRevoker.extensionDate?.toISOString() || null,
        revocationDate: tenantRevoker.revocationDate.toISOString(),
      },
    ];

  const expectedFeatureCertifierSQL: TenantFeatureSQL = {
    tenantId: tenant.data.id,
    metadataVersion: tenant.metadata.version,
    kind: tenantFeatureType.persistentCertifier,
    certifierId: tenantFeatureCertifier.certifierId,
    availabilityTimestamp: null,
  };
  const expectedFeatureDelegatedConsumerSQL: TenantFeatureSQL = {
    tenantId: tenant.data.id,
    metadataVersion: tenant.metadata.version,
    kind: tenantFeatureType.delegatedConsumer,
    certifierId: null,
    availabilityTimestamp:
      tenantFeatureDelegatedConsumer.availabilityTimestamp.toISOString(),
  };
  const expectedFeatureDelegatedProducerSQL: TenantFeatureSQL = {
    tenantId: tenant.data.id,
    metadataVersion: tenant.metadata.version,
    kind: tenantFeatureType.delegatedProducer,
    certifierId: null,
    availabilityTimestamp:
      tenantFeatureDelegatedProducer.availabilityTimestamp.toISOString(),
  };

  const expectedFeaturesSQL: TenantFeatureSQL[] = [
    expectedFeatureCertifierSQL,
    expectedFeatureDelegatedConsumerSQL,
    expectedFeatureDelegatedProducerSQL,
  ];

  return {
    expectedTenantSQL,
    expectedMailsSQL,
    expectedCertifiedAttributesSQL,
    expectedDeclaredAttributesSQL,
    expectedVerifiedAttributesSQL,
    expectedVerifiedAttributeVerifiersSQL,
    expectedVerifiedAttributeRevokersSQL,
    expectedFeaturesSQL,
  };
};

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}

export const sortATenant = (
  tenant: WithMetadata<Tenant>
): WithMetadata<Tenant> => ({
  data: {
    ...tenant.data,
    attributes: tenant.data.attributes.sort(sortAttributes),
    features: tenant.data.features.sort(sortFeatures),
  },
  metadata: tenant.metadata,
});

export const sortFeaturesSQL = (
  a: TenantFeatureSQL,
  b: TenantFeatureSQL
): number => sortByString(a.kind, b.kind);

export const sortFeatures = (a: TenantFeature, b: TenantFeature): number =>
  sortByString(a.type, b.type);

export const sortAttributes = (
  a: TenantAttribute,
  b: TenantAttribute
): number => sortByString(a.type, b.type);

export const sortTenants = (
  a: WithMetadata<Tenant>,
  b: WithMetadata<Tenant>
): number => sortByString(a.data.id, b.data.id);

const sortByString = (a: string, b: string): number => {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};
