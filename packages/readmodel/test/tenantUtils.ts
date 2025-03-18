/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockTenant,
  getMockTenantMail,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
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
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
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
  TenantId,
  tenantKind,
  TenantMail,
  TenantRevoker,
  tenantUnitType,
  TenantVerifier,
  VerifiedTenantAttribute,
  WithMetadata,
} from "pagopa-interop-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { tenantReadModelServiceBuilder } from "../src/tenantReadModelService.js";
import { readModelDB } from "./utils.js";

export const tenantReadModelService =
  tenantReadModelServiceBuilder(readModelDB);

export const initMockTenant = (
  isTenantComplete: boolean = true
): {
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
  const retrievedAndFormattedTenantSQL: TenantSQL | undefined =
    retrievedTenantSQL
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
  const retrievedAndFormattedTenantMailsSQL: TenantMailSQL[] | undefined =
    retrievedTenantMailsSQL?.map((mail) => ({
      ...mail,
      createdAt: stringToISOString(mail.createdAt),
    }));

  const retrievedCertifiedAttributesSQL =
    await retrieveTenantCertifiedAttributesSQL(tenant.data.id, readModelDB);

  const retrievedAndFormattedCertifiedAttributesSQL:
    | TenantCertifiedAttributeSQL[]
    | undefined = retrievedCertifiedAttributesSQL?.map(
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

  const retrievedAndFormattedDeclaredAttributesSQL:
    | TenantDeclaredAttributeSQL[]
    | undefined = retrievedDeclaredAttributesSQL?.map(
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
  const retrievedAndFormattedVerifiedAttributesSQL:
    | TenantVerifiedAttributeSQL[]
    | undefined = retrievedVerifiedAttributesSQL?.map(
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

  const retrievedAndFormattedVerifiedAttributeVerifiersSQL:
    | TenantVerifiedAttributeVerifierSQL[]
    | undefined = retrievedVerifiedAttributeVerifiersSQL?.map(
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

  const retrievedAndFormattedVerifiedAttributeRevokesSQL:
    | TenantVerifiedAttributeRevokerSQL[]
    | undefined = retrievedVerifiedAttributeRevokersSQL?.map(
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

  const retrievedFeaturesSQL = await retrieveTenantFeaturesSQL(
    tenant.data.id,
    readModelDB
  );

  const retrievedAndFormattedFeaturesSQL: TenantFeatureSQL[] | undefined =
    retrievedFeaturesSQL?.map((feature: TenantFeatureSQL) => ({
      ...feature,
      availabilityTimestamp: stringToISOString(feature.availabilityTimestamp),
      certifierId: feature.certifierId,
    }));

  return {
    retrievedTenantSQL: retrievedAndFormattedTenantSQL,
    retrievedMailsSQL: retrievedAndFormattedTenantMailsSQL,
    retrievedCertifiedAttributesSQL:
      retrievedAndFormattedCertifiedAttributesSQL,
    retrievedDeclaredAttributesSQL: retrievedAndFormattedDeclaredAttributesSQL,
    retrievedVerifiedAttributesSQL: retrievedAndFormattedVerifiedAttributesSQL,
    retrievedVerifiedAttributeVerifiersSQL:
      retrievedAndFormattedVerifiedAttributeVerifiersSQL,
    retrievedVerifiedAttributeRevokersSQL:
      retrievedAndFormattedVerifiedAttributeRevokesSQL,
    retrievedFeaturesSQL: retrievedAndFormattedFeaturesSQL,
  };
};

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}

export const retrieveTenantSQL = async (
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

export const retrieveTenantFeaturesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantFeatureSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantFeatureInReadmodelTenant)
    .where(eq(tenantFeatureInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

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
