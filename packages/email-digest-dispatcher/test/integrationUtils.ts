/* eslint-disable functional/no-let */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  getMockTenant,
  getMockEService,
  getMockDescriptor,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Descriptor,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  descriptorState,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  upsertAgreement,
  upsertEService,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
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

afterEach(cleanup);

export const readModelService = readModelServiceBuilder(readModelDB);

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
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
  publishedAt?: Date
): Descriptor => ({
  ...getMockDescriptor(),
  state,
  publishedAt:
    publishedAt ||
    (state === descriptorState.published ? new Date() : undefined),
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
  daysAgo = 1,
  agreementCount = 0
): { eservice: EService; tenant: Tenant; agreements: Agreement[] } => {
  const tenant = createMockTenant({ id: producerId });
  const publishedAt = new Date();
  publishedAt.setDate(publishedAt.getDate() - daysAgo);

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
  daysAgo = 10
): { eservice: EService; tenant: Tenant } => {
  const tenant = createMockTenant({ id: producerId });
  const publishedAt = new Date();
  publishedAt.setDate(publishedAt.getDate() - daysAgo);

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
  const priorityProducer1 = createMockTenant();
  const priorityProducer2 = createMockTenant();
  const regularProducer = createMockTenant();

  // Add producers to database
  await addOneTenant(priorityProducer1);
  await addOneTenant(priorityProducer2);
  await addOneTenant(regularProducer);

  // Create recent EServices with different characteristics
  const { eservice: priorityService1, agreements: agreements1 } =
    createRecentPublishedEService(priorityProducer1.id, 2, 5);
  const { eservice: priorityService2, agreements: agreements2 } =
    createRecentPublishedEService(priorityProducer2.id, 3, 2);
  const { eservice: regularService, agreements: agreements3 } =
    createRecentPublishedEService(regularProducer.id, 1, 10);

  // Create old EService (should not appear in results)
  const { eservice: oldService } = createOldPublishedEService(
    regularProducer.id,
    10
  );

  // Add EServices to database
  await addOneEService(priorityService1);
  await addOneEService(priorityService2);
  await addOneEService(regularService);
  await addOneEService(oldService);

  // Add consumer tenants and agreements
  const consumerTenants = new Set<TenantId>();
  [...agreements1, ...agreements2, ...agreements3].forEach((agreement) => {
    consumerTenants.add(agreement.consumerId);
  });

  // Add consumer tenants to database
  for (const consumerId of consumerTenants) {
    const consumerTenant = createMockTenant({ id: consumerId });
    await addOneTenant(consumerTenant);
  }

  // Add agreements to database
  for (const agreement of [...agreements1, ...agreements2, ...agreements3]) {
    await addOneAgreement(agreement);
  }

  return {
    priorityProducers: [priorityProducer1.id, priorityProducer2.id],
    services: {
      priorityService1: {
        ...priorityService1,
        agreementCount: agreements1.length,
      },
      priorityService2: {
        ...priorityService2,
        agreementCount: agreements2.length,
      },
      regularService: { ...regularService, agreementCount: agreements3.length },
      oldService,
    },
    producers: {
      priorityProducer1,
      priorityProducer2,
      regularProducer,
    },
  };
};
