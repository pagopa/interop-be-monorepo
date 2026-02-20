/* eslint-disable functional/no-let */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  getMockTenant,
  getMockEService,
  getMockDescriptor,
  getMockAgreement,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAttribute,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Descriptor,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  DescriptorId,
  descriptorState,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  CorrelationId,
  EServiceTemplateVersionState,
  Attribute,
  AttributeId,
  attributeKind,
  VerifiedTenantAttribute,
  CertifiedTenantAttribute,
  tenantAttributeType,
  TenantVerifier,
  TenantRevoker,
  Purpose,
  PurposeVersion,
  PurposeVersionState,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  upsertAgreement,
  upsertEService,
  upsertTenant,
  upsertEServiceTemplate,
  upsertAttribute,
  upsertPurpose,
} from "pagopa-interop-readmodel/testUtils";
import { logger } from "pagopa-interop-commons";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig"),
  undefined,
  undefined,
  undefined
);

const correlationId = generateId<CorrelationId>();
const log = logger({
  serviceName: "email-notification-digest",
  correlationId,
});

afterEach(cleanup);

export const readModelService = readModelServiceBuilder(readModelDB, log);

// Test constants
export const TEST_TIME_WINDOWS = {
  WITHIN_RANGE: 2,
  OUTSIDE_RANGE: 10,
  RECENT: 1,
  FIVE_DAYS_AGO: 5,
  THREE_DAYS_AGO: 3,
  FOUR_DAYS_AGO: 4,
} as const;

export const TEST_LIMITS = {
  MAX_RESULTS: 5,
} as const;

/**
 * Creates a date in the past by the specified number of days
 */
export const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneEServiceTemplate = async (
  eserviceTemplate: EServiceTemplate
): Promise<void> => {
  await upsertEServiceTemplate(readModelDB, eserviceTemplate, 0);
};

/**
 * Creates a mock tenant for testing purposes
 */
export const createMockTenant = (overrides?: Partial<Tenant>): Tenant => ({
  ...getMockTenant(),
  name: `Test Tenant ${Math.random().toString(36).substring(7)}`,
  ...overrides,
});

/**
 * Creates a mock EService for testing purposes
 */
export const createMockEService = (
  producerId: TenantId,
  overrides?: Partial<EService>
): EService => ({
  ...getMockEService(),
  name: `Test EService ${Math.random().toString(36).substring(7)}`,
  producerId,
  ...overrides,
});

/**
 * Creates a mock descriptor for testing purposes
 */
export const createMockDescriptor = (
  state: Descriptor["state"] = descriptorState.published,
  publishedAt?: Date,
  overrides?: Partial<Descriptor>
): Descriptor => ({
  ...getMockDescriptor(),
  state,
  publishedAt:
    publishedAt ||
    (state === descriptorState.published ? new Date() : undefined),
  ...overrides,
});

/**
 * Creates a mock agreement for testing purposes
 */
export const createMockAgreement = (
  eserviceId: EServiceId,
  consumerId: TenantId,
  overrides?: Partial<Agreement>
): Agreement => ({
  ...getMockAgreement(eserviceId, consumerId),
  ...overrides,
});

/**
 * Creates an EService with a published descriptor for recent new services testing
 */
export const createRecentPublishedEService = (
  producerId: TenantId,
  daysAgoCount = 1,
  agreementCount = 0
): { eservice: EService; tenant: Tenant; agreements: Agreement[] } => {
  const tenant = createMockTenant({ id: producerId });
  const publishedAt = daysAgo(daysAgoCount);

  const descriptor = createMockDescriptor(
    descriptorState.published,
    publishedAt
  );
  const eservice = createMockEService(producerId, {
    descriptors: [descriptor],
  });

  // Create agreements for the service
  const agreements: Agreement[] = Array.from({ length: agreementCount }, () => {
    const consumerTenant = getMockTenant();
    return createMockAgreement(eservice.id, consumerTenant.id, {
      descriptorId: descriptor.id,
      producerId,
    });
  });

  return { eservice, tenant, agreements };
};

/**
 * Creates an EService with an old published descriptor (outside the time window)
 */
export const createOldPublishedEService = (
  producerId: TenantId,
  daysAgoCount = 10
): { eservice: EService; tenant: Tenant } => {
  const tenant = createMockTenant({ id: producerId });
  const publishedAt = daysAgo(daysAgoCount);

  const descriptor = createMockDescriptor(
    descriptorState.published,
    publishedAt
  );
  const eservice = createMockEService(producerId, {
    descriptors: [descriptor],
  });

  return { eservice, tenant };
};

/**
 * Creates and persists a tenant
 */
const createAndAddTenant = async (
  overrides?: Partial<Tenant>
): Promise<Tenant> => {
  const tenant = createMockTenant(overrides);
  await addOneTenant(tenant);
  return tenant;
};

/**
 * Creates and persists an e-service with agreements
 */
const createAndAddEServiceWithAgreements = async (
  producerId: TenantId,
  daysAgo: number,
  agreementCount: number
): Promise<{
  eservice: EService & { agreementCount: number };
  agreements: Agreement[];
}> => {
  const { eservice, agreements } = createRecentPublishedEService(
    producerId,
    daysAgo,
    agreementCount
  );

  await addOneEService(eservice);

  // Add consumer tenants
  const consumerTenants = new Set<TenantId>();
  agreements.forEach((agreement) => consumerTenants.add(agreement.consumerId));

  for (const consumerId of consumerTenants) {
    const consumerTenant = createMockTenant({ id: consumerId });
    await addOneTenant(consumerTenant);
  }

  // Add agreements
  for (const agreement of agreements) {
    await addOneAgreement(agreement);
  }

  return {
    eservice: { ...eservice, agreementCount: agreements.length },
    agreements,
  };
};

/**
 * Sets up test data with multiple EServices for comprehensive testing
 */
export const setupTestData = async (): Promise<{
  priorityProducers: TenantId[];
  services: {
    priorityService1: EService & { agreementCount: number };
    priorityService2: EService & { agreementCount: number };
    regularService: EService & { agreementCount: number };
    oldService: EService;
  };
  producers: {
    priorityProducer1: Tenant;
    priorityProducer2: Tenant;
    regularProducer: Tenant;
  };
}> => {
  // Create and persist tenants
  const priorityProducer1 = await createAndAddTenant();
  const priorityProducer2 = await createAndAddTenant();
  const regularProducer = await createAndAddTenant();

  // Create and persist services with agreements
  const { eservice: priorityService1 } =
    await createAndAddEServiceWithAgreements(priorityProducer1.id, 2, 5);
  const { eservice: priorityService2 } =
    await createAndAddEServiceWithAgreements(priorityProducer2.id, 3, 2);
  const { eservice: regularService } = await createAndAddEServiceWithAgreements(
    regularProducer.id,
    1,
    10
  );

  // Create old EService (should not appear in results)
  const { eservice: oldService } = createOldPublishedEService(
    regularProducer.id,
    TEST_TIME_WINDOWS.OUTSIDE_RANGE
  );
  await addOneEService(oldService);

  return {
    priorityProducers: [priorityProducer1.id, priorityProducer2.id],
    services: {
      priorityService1,
      priorityService2,
      regularService,
      oldService,
    },
    producers: {
      priorityProducer1,
      priorityProducer2,
      regularProducer,
    },
  };
};

/**
 * Creates a descriptor with specific version and publish date
 */
export const createRecentDescriptor = (
  version: string,
  daysAgoCount = 1
): Descriptor => {
  const publishedAt = daysAgo(daysAgoCount);

  return createMockDescriptor(descriptorState.published, publishedAt, {
    version,
  });
};

/**
 * Creates an EService with multiple descriptors of specified versions
 */
export const createEServiceWithVersions = (
  producerId: TenantId,
  versions: Array<{ version: string; daysAgo?: number }>
): EService => {
  const descriptors = versions.map(({ version, daysAgo }) =>
    createRecentDescriptor(version, daysAgo)
  );

  return createMockEService(producerId, { descriptors });
};

/**
 * Creates an agreement for a consumer to a specific descriptor
 */
export const createConsumerAgreement = (
  consumerId: TenantId,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  producerId: TenantId
): Agreement =>
  createMockAgreement(eserviceId, consumerId, {
    descriptorId,
    producerId,
    state: "Active",
  });

/**
 * Creates a mock EServiceTemplate for testing purposes
 */
export const createMockEServiceTemplate = (
  creatorId: TenantId,
  overrides?: Partial<EServiceTemplate>
): EServiceTemplate => ({
  ...getMockEServiceTemplate(undefined, creatorId),
  name: `Test Template ${Math.random().toString(36).substring(7)}`,
  ...overrides,
});

/**
 * Creates a mock EServiceTemplateVersion for testing purposes
 */
export const createMockEServiceTemplateVersion = (
  state: EServiceTemplateVersionState = eserviceTemplateVersionState.draft,
  version: string = "1",
  createdAt?: Date,
  overrides?: Partial<EServiceTemplateVersion>
): EServiceTemplateVersion => ({
  ...getMockEServiceTemplateVersion(undefined, state),
  version: version as unknown as number, // DB schema uses varchar, but mock returns number
  createdAt: createdAt || new Date(),
  ...overrides,
});

/**
 * Creates an EService using a template
 */
export const createEServiceWithTemplate = (
  producerId: TenantId,
  templateId: EServiceTemplateId,
  templateVersionId: EServiceTemplateVersionId,
  descriptorOverrides?: Partial<Descriptor>
): EService => {
  const descriptor = createMockDescriptor(
    descriptorState.published,
    new Date(),
    {
      ...descriptorOverrides,
      templateVersionRef: {
        id: templateVersionId,
      },
    }
  );
  return createMockEService(producerId, {
    templateId,
    descriptors: [descriptor],
  });
};

/**
 * Creates an EService using a template with a specific createdAt date
 */
export const createEServiceWithTemplateAndDate = (
  producerId: TenantId,
  templateId: EServiceTemplateId,
  createdAt: Date,
  descriptorState: Descriptor["state"] = "Published"
): EService => {
  const descriptor = createMockDescriptor(descriptorState, createdAt);
  return {
    ...createMockEService(producerId, {
      templateId,
      descriptors: [descriptor],
    }),
    createdAt,
  };
};

/**
 * Creates a template with a published version at a specific time
 */
export const createTemplateWithPublishedVersion = (
  creatorId: TenantId,
  version: string,
  daysAgoCount = 1
): { template: EServiceTemplate; versionId: EServiceTemplateVersionId } => {
  const createdAt = daysAgo(daysAgoCount);

  const templateVersion = createMockEServiceTemplateVersion(
    eserviceTemplateVersionState.published,
    version,
    createdAt,
    { publishedAt: createdAt }
  );

  const template = createMockEServiceTemplate(creatorId, {
    versions: [templateVersion],
  });

  return { template, versionId: templateVersion.id };
};

/**
 * Creates a template with multiple versions
 */
export const createTemplateWithVersions = (
  creatorId: TenantId,
  versions: Array<{
    version: string;
    state: EServiceTemplateVersionState;
    daysAgo?: number;
  }>
): { template: EServiceTemplate; versionIds: EServiceTemplateVersionId[] } => {
  const templateVersions = versions.map(
    ({ version, state, daysAgo: daysAgoCount = 1 }) => {
      const createdAt = daysAgo(daysAgoCount);

      return createMockEServiceTemplateVersion(state, version, createdAt, {
        publishedAt:
          state === eserviceTemplateVersionState.published
            ? createdAt
            : undefined,
      });
    }
  );

  const template = createMockEServiceTemplate(creatorId, {
    versions: templateVersions,
  });

  return {
    template,
    versionIds: templateVersions.map((v) => v.id),
  };
};

/**
 * Creates a complete template test scenario with template, versions, and e-service
 */
export const createTemplateScenario = async (
  consumerId: TenantId,
  config: {
    usedVersion: string;
    newVersions: Array<{
      version: string;
      daysAgo: number;
      state: EServiceTemplateVersionState;
    }>;
    eserviceCount?: number;
  }
): Promise<{
  template: EServiceTemplate;
  versionIds: EServiceTemplateVersionId[];
  eservices: EService[];
}> => {
  const allVersions = [
    {
      version: config.usedVersion,
      state: eserviceTemplateVersionState.published,
      daysAgo: TEST_TIME_WINDOWS.OUTSIDE_RANGE,
    },
    ...config.newVersions,
  ];

  const { template, versionIds } = createTemplateWithVersions(
    consumerId,
    allVersions
  );

  await addOneEServiceTemplate(template);

  const eserviceCount = config.eserviceCount ?? 1;
  const eservices: EService[] = [];

  for (let i = 0; i < eserviceCount; i++) {
    const eservice = createEServiceWithTemplate(
      consumerId,
      template.id,
      versionIds[0],
      { version: config.usedVersion }
    );
    await addOneEService(eservice);
    // eslint-disable-next-line functional/immutable-data
    eservices.push(eservice);
  }

  return { template, versionIds, eservices };
};

/**
 * Creates a mock attribute for testing purposes
 */
export const createMockAttribute = (
  overrides?: Partial<Attribute>
): Attribute => ({
  ...getMockAttribute(attributeKind.verified),
  name: `Test Attribute ${Math.random().toString(36).substring(7)}`,
  ...overrides,
});

/**
 * Adds an attribute to the database
 */
export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};

/**
 * Creates a TenantVerifier for verified attributes
 */
export const createMockTenantVerifier = (
  verifierId: TenantId,
  verificationDate: Date,
  overrides?: Partial<TenantVerifier>
): TenantVerifier => ({
  id: verifierId,
  verificationDate,
  ...overrides,
});

/**
 * Creates a TenantRevoker for revoked attributes
 */
export const createMockTenantRevoker = (
  revokerId: TenantId,
  verificationDate: Date,
  revocationDate: Date,
  overrides?: Partial<TenantRevoker>
): TenantRevoker => ({
  id: revokerId,
  verificationDate,
  revocationDate,
  ...overrides,
});

/**
 * Creates a VerifiedTenantAttribute
 */
export const createMockVerifiedTenantAttribute = (
  attributeId: AttributeId,
  verifiedBy: TenantVerifier[] = [],
  revokedBy: TenantRevoker[] = []
): VerifiedTenantAttribute => ({
  id: attributeId,
  type: tenantAttributeType.VERIFIED,
  assignmentTimestamp: new Date(),
  verifiedBy,
  revokedBy,
});

/**
 * Creates a tenant with a verified attribute
 */
export const createTenantWithVerifiedAttribute = (
  tenantId: TenantId,
  attributeId: AttributeId,
  verifierId: TenantId,
  verificationDate: Date
): Tenant => {
  const verifier = createMockTenantVerifier(verifierId, verificationDate);
  const verifiedAttribute = createMockVerifiedTenantAttribute(attributeId, [
    verifier,
  ]);

  return createMockTenant({
    id: tenantId,
    attributes: [verifiedAttribute],
  });
};

/**
 * Creates a tenant with a revoked attribute
 */
export const createTenantWithRevokedAttribute = (
  tenantId: TenantId,
  attributeId: AttributeId,
  revokerId: TenantId,
  verificationDate: Date,
  revocationDate: Date
): Tenant => {
  const revoker = createMockTenantRevoker(
    revokerId,
    verificationDate,
    revocationDate
  );
  const verifiedAttribute = createMockVerifiedTenantAttribute(
    attributeId,
    [],
    [revoker]
  );

  return createMockTenant({
    id: tenantId,
    attributes: [verifiedAttribute],
  });
};

/**
 * Creates a complete scenario for verified attribute testing
 */
export const createVerifiedAttributeScenario = async (config: {
  tenantId: TenantId;
  verifierId: TenantId;
  attributeName?: string;
  verificationDaysAgo: number;
}): Promise<{
  tenant: Tenant;
  verifier: Tenant;
  attribute: Attribute;
}> => {
  const verificationDate = daysAgo(config.verificationDaysAgo);
  const attribute = createMockAttribute(
    config.attributeName ? { name: config.attributeName } : undefined
  );

  await addOneAttribute(attribute);

  const verifier = createMockTenant({ id: config.verifierId });
  await addOneTenant(verifier);

  const tenant = createTenantWithVerifiedAttribute(
    config.tenantId,
    attribute.id,
    config.verifierId,
    verificationDate
  );
  await addOneTenant(tenant);

  return { tenant, verifier, attribute };
};

/**
 * Creates a complete scenario for revoked attribute testing
 */
export const createRevokedAttributeScenario = async (config: {
  tenantId: TenantId;
  revokerId: TenantId;
  attributeName?: string;
  verificationDaysAgo: number;
  revocationDaysAgo: number;
}): Promise<{
  tenant: Tenant;
  revoker: Tenant;
  attribute: Attribute;
}> => {
  const verificationDate = daysAgo(config.verificationDaysAgo);
  const revocationDate = daysAgo(config.revocationDaysAgo);
  const attribute = createMockAttribute(
    config.attributeName ? { name: config.attributeName } : undefined
  );

  await addOneAttribute(attribute);

  const revoker = createMockTenant({ id: config.revokerId });
  await addOneTenant(revoker);

  const tenant = createTenantWithRevokedAttribute(
    config.tenantId,
    attribute.id,
    config.revokerId,
    verificationDate,
    revocationDate
  );
  await addOneTenant(tenant);

  return { tenant, revoker, attribute };
};

/**
 * Creates a CertifiedTenantAttribute
 */
export const createMockCertifiedTenantAttribute = (
  attributeId: AttributeId,
  assignmentTimestamp: Date,
  revocationTimestamp?: Date
): CertifiedTenantAttribute => ({
  id: attributeId,
  type: tenantAttributeType.CERTIFIED,
  assignmentTimestamp,
  revocationTimestamp,
});

/**
 * Creates a tenant with a certified assigned attribute
 */
export const createTenantWithCertifiedAssignedAttribute = (
  tenantId: TenantId,
  attributeId: AttributeId,
  assignmentTimestamp: Date
): Tenant => {
  const certifiedAttribute = createMockCertifiedTenantAttribute(
    attributeId,
    assignmentTimestamp
  );

  return createMockTenant({
    id: tenantId,
    attributes: [certifiedAttribute],
  });
};

/**
 * Creates a tenant with a certified revoked attribute
 */
export const createTenantWithCertifiedRevokedAttribute = (
  tenantId: TenantId,
  attributeId: AttributeId,
  assignmentTimestamp: Date,
  revocationTimestamp: Date
): Tenant => {
  const certifiedAttribute = createMockCertifiedTenantAttribute(
    attributeId,
    assignmentTimestamp,
    revocationTimestamp
  );

  return createMockTenant({
    id: tenantId,
    attributes: [certifiedAttribute],
  });
};

/**
 * Creates a complete scenario for certified assigned attribute testing
 */
export const createCertifiedAssignedAttributeScenario = async (config: {
  tenantId: TenantId;
  attributeName?: string;
  assignmentDaysAgo: number;
}): Promise<{
  tenant: Tenant;
  attribute: Attribute;
}> => {
  const assignmentTimestamp = daysAgo(config.assignmentDaysAgo);
  const attribute = createMockAttribute(
    config.attributeName
      ? { name: config.attributeName, kind: attributeKind.certified }
      : { kind: attributeKind.certified }
  );

  await addOneAttribute(attribute);

  const tenant = createTenantWithCertifiedAssignedAttribute(
    config.tenantId,
    attribute.id,
    assignmentTimestamp
  );
  await addOneTenant(tenant);

  return { tenant, attribute };
};

/**
 * Creates a complete scenario for certified revoked attribute testing
 */
export const createCertifiedRevokedAttributeScenario = async (config: {
  tenantId: TenantId;
  attributeName?: string;
  assignmentDaysAgo: number;
  revocationDaysAgo: number;
}): Promise<{
  tenant: Tenant;
  attribute: Attribute;
}> => {
  const assignmentTimestamp = daysAgo(config.assignmentDaysAgo);
  const revocationTimestamp = daysAgo(config.revocationDaysAgo);
  const attribute = createMockAttribute(
    config.attributeName
      ? { name: config.attributeName, kind: attributeKind.certified }
      : { kind: attributeKind.certified }
  );

  await addOneAttribute(attribute);

  const tenant = createTenantWithCertifiedRevokedAttribute(
    config.tenantId,
    attribute.id,
    assignmentTimestamp,
    revocationTimestamp
  );
  await addOneTenant(tenant);

  return { tenant, attribute };
};

/**
 * Creates a tenant with multiple attributes (verified and certified, assigned and revoked)
 * This is useful for testing totalCount accuracy with more than 5 records
 */
export const createTenantWithMultipleAttributes = async (config: {
  tenantId: TenantId;
  verifiedAssignedCount: number;
  verifiedRevokedCount: number;
  certifiedAssignedCount: number;
  certifiedRevokedCount: number;
}): Promise<{
  tenant: Tenant;
  verifiers: Tenant[];
  revokers: Tenant[];
  attributes: Attribute[];
}> => {
  const attributes: Attribute[] = [];
  const verifiedAttributes: VerifiedTenantAttribute[] = [];
  const certifiedAttributes: CertifiedTenantAttribute[] = [];
  const verifiers: Tenant[] = [];
  const revokers: Tenant[] = [];

  // Create verified assigned attributes
  for (let i = 0; i < config.verifiedAssignedCount; i++) {
    const attribute = createMockAttribute({
      name: `Verified Assigned ${i + 1}`,
      kind: attributeKind.verified,
    });
    await addOneAttribute(attribute);
    // eslint-disable-next-line functional/immutable-data
    attributes.push(attribute);

    const verifierId = generateId<TenantId>();
    const verifier = createMockTenant({ id: verifierId });
    await addOneTenant(verifier);
    // eslint-disable-next-line functional/immutable-data
    verifiers.push(verifier);

    const verificationDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
    const tenantVerifier = createMockTenantVerifier(
      verifierId,
      verificationDate
    );
    const verifiedAttr = createMockVerifiedTenantAttribute(attribute.id, [
      tenantVerifier,
    ]);
    // eslint-disable-next-line functional/immutable-data
    verifiedAttributes.push(verifiedAttr);
  }

  // Create verified revoked attributes
  for (let i = 0; i < config.verifiedRevokedCount; i++) {
    const attribute = createMockAttribute({
      name: `Verified Revoked ${i + 1}`,
      kind: attributeKind.verified,
    });
    await addOneAttribute(attribute);
    // eslint-disable-next-line functional/immutable-data
    attributes.push(attribute);

    const revokerId = generateId<TenantId>();
    const revoker = createMockTenant({ id: revokerId });
    await addOneTenant(revoker);
    // eslint-disable-next-line functional/immutable-data
    revokers.push(revoker);

    const verificationDate = daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE);
    const revocationDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
    const tenantRevoker = createMockTenantRevoker(
      revokerId,
      verificationDate,
      revocationDate
    );
    const verifiedAttr = createMockVerifiedTenantAttribute(
      attribute.id,
      [],
      [tenantRevoker]
    );
    // eslint-disable-next-line functional/immutable-data
    verifiedAttributes.push(verifiedAttr);
  }

  // Create certified assigned attributes
  for (let i = 0; i < config.certifiedAssignedCount; i++) {
    const attribute = createMockAttribute({
      name: `Certified Assigned ${i + 1}`,
      kind: attributeKind.certified,
    });
    await addOneAttribute(attribute);
    // eslint-disable-next-line functional/immutable-data
    attributes.push(attribute);

    const assignmentTimestamp = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
    const certifiedAttr = createMockCertifiedTenantAttribute(
      attribute.id,
      assignmentTimestamp
    );
    // eslint-disable-next-line functional/immutable-data
    certifiedAttributes.push(certifiedAttr);
  }

  // Create certified revoked attributes
  for (let i = 0; i < config.certifiedRevokedCount; i++) {
    const attribute = createMockAttribute({
      name: `Certified Revoked ${i + 1}`,
      kind: attributeKind.certified,
    });
    await addOneAttribute(attribute);
    // eslint-disable-next-line functional/immutable-data
    attributes.push(attribute);

    const assignmentTimestamp = daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE);
    const revocationTimestamp = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
    const certifiedAttr = createMockCertifiedTenantAttribute(
      attribute.id,
      assignmentTimestamp,
      revocationTimestamp
    );
    // eslint-disable-next-line functional/immutable-data
    certifiedAttributes.push(certifiedAttr);
  }

  // Create tenant with all attributes
  const tenant = createMockTenant({
    id: config.tenantId,
    attributes: [...verifiedAttributes, ...certifiedAttributes],
  });
  await addOneTenant(tenant);

  return { tenant, verifiers, revokers, attributes };
};

/**
 * Adds a purpose to the database
 */
export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
};

/**
 * Creates a mock purpose with specified versions
 */
export const createMockPurpose = (
  consumerId: TenantId,
  eserviceId: EServiceId,
  versions: PurposeVersion[] = [],
  overrides?: Partial<Purpose>
): Purpose => ({
  ...getMockPurpose(versions),
  consumerId,
  eserviceId,
  title: `Test Purpose ${Math.random().toString(36).substring(7)}`,
  ...overrides,
});

/**
 * Creates a mock purpose version with specified state and dates
 */
export const createMockPurposeVersion = (
  state: PurposeVersionState,
  createdAt: Date,
  updatedAt?: Date
): PurposeVersion => ({
  ...getMockPurposeVersion(state),
  createdAt,
  updatedAt,
});

/**
 * Creates a purpose with a version in a specific state at a specific time
 */
export const createPurposeWithVersion = (
  consumerId: TenantId,
  eserviceId: EServiceId,
  state: PurposeVersionState,
  actionDate: Date,
  overrides?: Partial<Purpose>
): Purpose => {
  const version = createMockPurposeVersion(
    state,
    daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE), // createdAt is older
    actionDate // updatedAt is the action date
  );

  return createMockPurpose(consumerId, eserviceId, [version], overrides);
};
