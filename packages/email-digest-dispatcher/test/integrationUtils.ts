/* eslint-disable functional/no-let */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  getMockTenant,
  getMockEService,
  getMockDescriptor,
  getMockAgreement,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
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
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  upsertAgreement,
  upsertEService,
  upsertTenant,
  upsertEServiceTemplate,
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
