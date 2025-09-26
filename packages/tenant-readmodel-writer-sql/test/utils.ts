import { inject, afterEach } from "vitest";
import {
  getMockTenant,
  getMockTenantMail,
  getMockVerifiedTenantAttribute,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { tenantReadModelServiceBuilder } from "pagopa-interop-readmodel";
import {
  AttributeId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  DelegationId,
  ExternalId,
  generateId,
  Tenant,
  tenantAttributeType,
  TenantFeature,
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
import {
  TenantSQL,
  TenantMailSQL,
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantFeatureSQL,
  DrizzleReturnType,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { tenantWriterServiceBuilder } from "../src/tenantWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const tenantReadModelService =
  tenantReadModelServiceBuilder(readModelDB);
export const tenantWriterService = tenantWriterServiceBuilder(readModelDB);

export const getCustomMockDeclaredTenantAttribute =
  (): DeclaredTenantAttribute => ({
    type: tenantAttributeType.DECLARED,
    id: generateId(),
    assignmentTimestamp: new Date(),
  });

export const getCustomMockCertifiedTenantAttribute =
  (): CertifiedTenantAttribute => ({
    type: tenantAttributeType.CERTIFIED,
    id: generateId(),
    assignmentTimestamp: new Date(),
  });

export const initMockTenant = ({
  isTenantComplete,
}: {
  isTenantComplete: boolean;
}): {
  tenant: WithMetadata<Tenant>;
  tenantForVerifying: WithMetadata<Tenant>;
  tenantForRevoking: WithMetadata<Tenant>;
  tenantMails: TenantMail[];
  tenantCertifiedAttributes: CertifiedTenantAttribute[];
  tenantDeclaredAttributes: DeclaredTenantAttribute[];
  tenantVerifiedAttributes: VerifiedTenantAttribute[];
  tenantVerifier: TenantVerifier;
  tenantRevoker: TenantRevoker;
  tenantFeatures: TenantFeature[];
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

  const tenantVerifierAttributeOptionalProps = {
    expirationDate: new Date(),
    extensionDate: new Date(),
    delegationId,
  };
  const tenantVerifier: TenantVerifier = {
    id: tenantForVerifying.data.id,
    verificationDate: new Date(),
    ...(isTenantComplete ? tenantVerifierAttributeOptionalProps : {}),
  };
  const tenantRevokerAttributeOptionalProps = {
    expirationDate: new Date(),
    extensionDate: new Date(),
    delegationId,
  };
  const tenantRevoker: TenantRevoker = {
    id: tenantForRevoking.data.id,
    verificationDate: new Date(),
    revocationDate: new Date(),
    ...(isTenantComplete ? tenantRevokerAttributeOptionalProps : {}),
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
    {
      ...getMockTenantMail(),
      ...(isTenantComplete
        ? {
            description: "mail description 2",
          }
        : {}),
    },
  ];
  const tenantCertifiedAttributes: CertifiedTenantAttribute[] = [
    {
      id: generateId<AttributeId>(),
      type: tenantAttributeType.CERTIFIED,
      assignmentTimestamp: new Date(),
      ...(isTenantComplete
        ? {
            revocationTimestamp: new Date(),
          }
        : {}),
    },
  ];

  const tenantDeclaredAttributes: DeclaredTenantAttribute[] = [
    {
      id: generateId<AttributeId>(),
      type: tenantAttributeType.DECLARED,
      assignmentTimestamp: new Date(),
      ...(isTenantComplete
        ? {
            revocationTimestamp: new Date(),
            delegationId,
          }
        : {}),
    },
  ];

  const tenantVerifiedAttributes: VerifiedTenantAttribute[] = [
    {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [tenantVerifier],
      revokedBy: [tenantRevoker],
      assignmentTimestamp: new Date(),
    },
  ];

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

  const externalId: ExternalId = {
    origin: "IPA",
    value: generateId(),
  };

  const tenantOptionalProps = {
    kind: tenantKind.PA,
    selfcareId: generateId(),
    updatedAt: new Date(),
    onboardedAt: new Date(),
    subUnitType: tenantUnitType.AOO,
  };
  const tenantFeatures = [
    tenantFeatureDelegatedProducer,
    tenantFeatureDelegatedConsumer,
    tenantFeatureCertifier,
  ];
  const tenant: WithMetadata<Tenant> = {
    data: {
      name: "A tenant",
      id: generateId<TenantId>(),
      createdAt: new Date(),
      externalId,
      mails: tenantMails,
      attributes: [
        ...tenantCertifiedAttributes,
        ...tenantDeclaredAttributes,
        ...tenantVerifiedAttributes,
      ],
      features: tenantFeatures,
      ...(isTenantComplete ? tenantOptionalProps : {}),
    },
    metadata: {
      version: 1,
    },
  };

  return {
    tenant,
    tenantForVerifying,
    tenantForRevoking,
    tenantMails,
    tenantCertifiedAttributes,
    tenantDeclaredAttributes,
    tenantVerifiedAttributes,
    tenantVerifier,
    tenantRevoker,
    tenantFeatures,
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
  const retrievedTenantSQL = await retrieveTenantSQL(
    tenant.data.id,
    readModelDB
  );
  const retrievedMailsSQL = await retrieveTenantMailsSQL(
    tenant.data.id,
    readModelDB
  );
  const retrievedCertifiedAttributesSQL =
    await retrieveTenantCertifiedAttributesSQL(tenant.data.id, readModelDB);
  const retrievedDeclaredAttributesSQL =
    await retrieveTenantDeclaredAttributesSQL(tenant.data.id, readModelDB);
  const retrievedVerifiedAttributesSQL =
    await retrieveTenantVerifiedAttributesSQL(tenant.data.id, readModelDB);
  const retrievedVerifiedAttributeVerifiersSQL =
    await retrieveTenantVerifiedAttributeVerifiersSQL(
      tenant.data.id,
      readModelDB
    );
  const retrievedVerifiedAttributeRevokersSQL =
    await retrieveTenantVerifiedAttributeRevokersSQL(
      tenant.data.id,
      readModelDB
    );
  const retrievedFeaturesSQL = await retrieveTenantFeaturesSQL(
    tenant.data.id,
    readModelDB
  );

  return {
    retrievedTenantSQL,
    retrievedMailsSQL,
    retrievedCertifiedAttributesSQL,
    retrievedDeclaredAttributesSQL,
    retrievedVerifiedAttributesSQL,
    retrievedVerifiedAttributeVerifiersSQL,
    retrievedVerifiedAttributeRevokersSQL,
    retrievedFeaturesSQL,
  };
};

export const retrieveTenantSQL = async (
  tenantId: TenantId,
  db: DrizzleReturnType
): Promise<TenantSQL | undefined> => {
  const result = await db
    .select()
    .from(tenantInReadmodelTenant)
    .where(eq(tenantInReadmodelTenant.id, tenantId));
  return result[0];
};

export const retrieveTenantMailsSQL = async (
  tenantId: TenantId,
  db: DrizzleReturnType
): Promise<TenantMailSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantMailInReadmodelTenant)
    .where(eq(tenantMailInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantCertifiedAttributesSQL = async (
  tenantId: TenantId,
  db: DrizzleReturnType
): Promise<TenantCertifiedAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantCertifiedAttributeInReadmodelTenant)
    .where(eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantDeclaredAttributesSQL = async (
  tenantId: TenantId,
  db: DrizzleReturnType
): Promise<TenantDeclaredAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantDeclaredAttributeInReadmodelTenant)
    .where(eq(tenantDeclaredAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantVerifiedAttributesSQL = async (
  tenantId: TenantId,
  db: DrizzleReturnType
): Promise<TenantVerifiedAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantVerifiedAttributeInReadmodelTenant)
    .where(eq(tenantVerifiedAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantVerifiedAttributeVerifiersSQL = async (
  tenantId: TenantId,
  db: DrizzleReturnType
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
  db: DrizzleReturnType
): Promise<TenantVerifiedAttributeRevokerSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
    .where(
      eq(tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId, tenantId)
    );
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantFeaturesSQL = async (
  tenantId: TenantId,
  db: DrizzleReturnType
): Promise<TenantFeatureSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantFeatureInReadmodelTenant)
    .where(eq(tenantFeatureInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};
