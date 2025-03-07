/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
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
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  TenantMailSQL,
  TenantFeatureSQL,
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  DelegationId,
  ExternalId,
  generateId,
  stringToDate,
  Tenant,
  TenantFeatureCertifier,
  TenantFeatureDelegatedConsumer,
  TenantFeatureDelegatedProducer,
  tenantFeatureType,
  TenantId,
  tenantKind,
  TenantMail,
  TenantRevoker,
  tenantUnitType,
  TenantVerifier,
  VerifiedTenantAttribute,
  WithMetadata,
} from "pagopa-interop-models";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { tenantReadModelServiceBuilderSQL } from "../src/tenantReadModelServiceSQL.js";

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
  tenantReadModelServiceBuilderSQL(readModelDB);

export const initMockTenant = (): {
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
    expirationDate: new Date(),
    extensionDate: new Date(),
    delegationId,
  };
  const tenantRevoker: TenantRevoker = {
    id: tenantForRevoking.data.id,
    verificationDate: new Date(),
    revocationDate: new Date(),
    expirationDate: new Date(),
    extensionDate: new Date(),
    delegationId,
  };

  const tenantMails: TenantMail[] = [
    {
      ...getMockTenantMail(),
      description: "mail description",
    },
  ];
  const tenantCertifiedAttribute: CertifiedTenantAttribute = {
    ...getMockCertifiedTenantAttribute(),
    assignmentTimestamp: new Date(),
    revocationTimestamp: new Date(),
  };

  const tenantDeclaredAttribute: DeclaredTenantAttribute = {
    ...getMockDeclaredTenantAttribute(),
    assignmentTimestamp: new Date(),
    revocationTimestamp: new Date(),
    delegationId,
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
  const tenant: WithMetadata<Tenant> = {
    data: {
      ...getMockTenant(),
      selfcareId,
      kind: tenantKind.PA,
      subUnitType: tenantUnitType.AOO,
      externalId,
      updatedAt: new Date(),
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
    },
    metadata: { version: 1 },
  };

  return {
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
  tenant: WithMetadata<Tenant>
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
  const isTenantComplete = true;
  const retrievedTenantSQL = await retrieveTenantSQL(
    tenant.data.id,
    readModelDB
  );
  const retrievedAndFormattedTenantSQL = retrievedTenantSQL
    ? {
        ...retrievedTenantSQL,
        createdAt: stringToISOString(retrievedTenantSQL.createdAt),
        updatedAt: stringToISOString(retrievedTenantSQL.updatedAt),
        onboardedAt: stringToISOString(retrievedTenantSQL.onboardedAt),
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
    (feature) => ({
      ...feature,
      ...(isTenantComplete
        ? {
            availabilityTimestamp: stringToISOString(
              feature.availabilityTimestamp
            ),
            certifierId: feature.certifierId,
          }
        : {}),
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

export const generateCompleteExpectedTenantSQLObjects = ({
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
    kind: tenant.data.kind!,
    selfcareId: tenant.data.selfcareId!,
    createdAt: tenant.data.createdAt.toISOString(),
    updatedAt: tenant.data.updatedAt!.toISOString(),
    name: tenant.data.name,
    onboardedAt: tenant.data.onboardedAt!.toISOString(),
    subUnitType: tenant.data.subUnitType!,
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
      description: mail.description!,
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
        tenantCertifiedAttribute.revocationTimestamp!.toISOString(),
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
        tenantDeclaredAttribute.revocationTimestamp!.toISOString(),
      delegationId: tenantDeclaredAttribute.delegationId!,
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
        delegationId: tenantVerifier.delegationId!,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: tenantVerifier.verificationDate.toISOString(),
        expirationDate: tenantVerifier.expirationDate!.toISOString(),
        extensionDate: tenantVerifier.extensionDate!.toISOString(),
      },
    ];
  const expectedVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[] =
    [
      {
        tenantRevokerId: tenantRevoker.id,
        tenantId: tenant.data.id,
        metadataVersion: tenant.metadata.version,
        delegationId: tenantRevoker.delegationId!,
        tenantVerifiedAttributeId: tenantVerifiedAttribute.id,
        verificationDate: tenantRevoker.verificationDate.toISOString(),
        expirationDate: tenantRevoker.expirationDate!.toISOString(),
        extensionDate: tenantRevoker.extensionDate!.toISOString(),
        revocationDate: tenantRevoker.extensionDate!.toISOString(),
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

const retrieveTenantSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantSQL | undefined> => {
  const result = await db
    .select()
    .from(tenantInReadmodelTenant)
    .where(eq(tenantInReadmodelTenant.id, tenantId));
  return result[0];
};

export const retrieveTenantMailsSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantMailSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantMailInReadmodelTenant)
    .where(eq(tenantMailInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantCertifiedAttributesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantCertifiedAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantCertifiedAttributeInReadmodelTenant)
    .where(eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantDeclaredAttributesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantDeclaredAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantDeclaredAttributeInReadmodelTenant)
    .where(eq(tenantDeclaredAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantVerifiedAttributesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantVerifiedAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantVerifiedAttributeInReadmodelTenant)
    .where(eq(tenantVerifiedAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantVerifiedAttributeVerifiersSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantVerifiedAttributeVerifierSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantVerifiedAttributeVerifierInReadmodelTenant)
    .where(
      eq(tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId, tenantId)
    );
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantVerifiedAttributeRevokersSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantVerifiedAttributeRevokerSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
    .where(
      eq(tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId, tenantId)
    );
  return result.length > 0 ? result : undefined;
};

export const retrieveTenanFeaturesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantFeatureSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantFeatureInReadmodelTenant)
    .where(eq(tenantFeatureInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}
