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
  tenantMail: TenantMail;
  tenantCertifiedAttribute: CertifiedTenantAttribute;
  tenantDeclaredAttribute: DeclaredTenantAttribute;
  tenantVerifiedAttribute: VerifiedTenantAttribute;
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

  const tenantMail: TenantMail = {
    ...getMockTenantMail(),
    description: "mail description",
  };
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
      mails: [tenantMail],
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
    tenantMail,
    tenantCertifiedAttribute,
    tenantDeclaredAttribute,
    tenantVerifiedAttribute,
    tenantFeatureCertifier,
    tenantFeatureDelegatedConsumer,
    tenantFeatureDelegatedProducer,
  };
};

export const retrieveTenantSQLObjects = async (
  tenant: WithMetadata<Tenant>
): Promise<{
  retrievedTenant: TenantSQL | undefined;
  retrievedMails: TenantMailSQL[] | undefined;
  retrievedCertifiedAttributes: TenantCertifiedAttributeSQL[] | undefined;
  retrievedDeclaredAttributes: TenantDeclaredAttributeSQL[] | undefined;
  retrievedVerifiedAttributes: TenantVerifiedAttributeSQL[] | undefined;
  retrievedVerifiedAttributeVerifiers:
    | TenantVerifiedAttributeVerifierSQL[]
    | undefined;
  retrievedVerifiedAttributeRevokers:
    | TenantVerifiedAttributeRevokerSQL[]
    | undefined;
  retrievedFeatures: TenantFeatureSQL[] | undefined;
}> => {
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

  const retrieveCertifiedAttributesSQL =
    await retrieveTenantCertifiedAttributesSQL(tenant.data.id, readModelDB);
  const retrieveDeclaredAttributesSQL =
    await retrieveTenantDeclaredAttributesSQL(tenant.data.id, readModelDB);
  const retrieveVerifiedAttributesSQL =
    await retrieveTenantVerifiedAttributesSQL(tenant.data.id, readModelDB);

  const retrieveVerifiedAttributeVerifiersSQL =
    await retrieveTenantVerifiedAttributeVerifiersSQL(
      tenant.data.id,
      readModelDB
    );

  const retrieveVerifiedAttributeRevokersSQL =
    await retrieveTenantVerifiedAttributeRevokersSQL(
      tenant.data.id,
      readModelDB
    );

  const retrievedFeaturesSQL = await retrieveTenanFeaturesSQL(
    tenant.data.id,
    readModelDB
  );

  return {
    retrievedTenant: retrievedAndFormattedTenantSQL,
    retrievedMails: retrievedAndFormattedTenantMailsSQL,
    retrievedCertifiedAttributes: retrieveCertifiedAttributesSQL,
    retrievedDeclaredAttributes: retrieveDeclaredAttributesSQL,
    retrievedVerifiedAttributes: retrieveVerifiedAttributesSQL,
    retrievedVerifiedAttributeVerifiers: retrieveVerifiedAttributeVerifiersSQL,
    retrievedVerifiedAttributeRevokers: retrieveVerifiedAttributeRevokersSQL,
    retrievedFeatures: retrievedFeaturesSQL,
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
