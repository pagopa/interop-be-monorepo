import { describe, test, expect, beforeEach } from "vitest";
import {
  DescriptorId,
  EServiceId,
  TenantId,
  Tenant,
  descriptorState,
} from "pagopa-interop-models";
import {
  readModelService,
  addOneTenant,
  addOneEService,
  addOneAgreement,
  createMockTenant,
  createMockEService,
  createMockDescriptor,
  createMockAgreement,
  createRecentPublishedEService,
  createOldPublishedEService,
  setupTestData,
  createEServiceWithVersions,
  createConsumerAgreement,
} from "./integrationUtils.js";

describe("ReadModelService - getNewEservices", () => {
  describe("Basic functionality", () => {
    test("should return empty array when no recently published EServices exist", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      // Create old EService (published more than 7 days ago)
      const { eservice: oldService } = createOldPublishedEService(
        producer.id,
        10
      );
      await addOneEService(oldService);

      const result = await readModelService.getNewEservices([]);
      expect(result).toEqual([]);
    });

    test("should return recently published EServices within the 7-day window", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      // Create recent EService (published 2 days ago)
      const { eservice: recentService } = createRecentPublishedEService(
        producer.id,
        2,
        0
      );
      await addOneEService(recentService);

      const result = await readModelService.getNewEservices([]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        eserviceId: recentService.id,
        eserviceDescriptorId: recentService.descriptors[0].id,
        eserviceName: recentService.name,
        eserviceProducerId: producer.id,
        agreementCount: 0,
        totalCount: 1,
      });
    });

    test("should not return EServices with non-published descriptors", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const draftDescriptor = createMockDescriptor(descriptorState.draft);
      const suspendedDescriptor = createMockDescriptor(
        descriptorState.suspended
      );
      const deprecatedDescriptor = createMockDescriptor(
        descriptorState.deprecated
      );

      const draftService = createMockEService(producer.id, {
        descriptors: [draftDescriptor],
      });
      const suspendedService = createMockEService(producer.id, {
        descriptors: [suspendedDescriptor],
      });
      const deprecatedService = createMockEService(producer.id, {
        descriptors: [deprecatedDescriptor],
      });

      await addOneEService(draftService);
      await addOneEService(suspendedService);
      await addOneEService(deprecatedService);

      const result = await readModelService.getNewEservices([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("Priority producers functionality", () => {
    test("should prioritize EServices from priority producers", async () => {
      const priorityProducer = createMockTenant();
      const regularProducer = createMockTenant();
      await addOneTenant(priorityProducer);
      await addOneTenant(regularProducer);

      // Create EServices with same characteristics but different producer types
      const { eservice: priorityService } = createRecentPublishedEService(
        priorityProducer.id,
        1,
        5
      );
      const { eservice: regularService } = createRecentPublishedEService(
        regularProducer.id,
        1,
        10
      ); // More agreements but not priority

      await addOneEService(priorityService);
      await addOneEService(regularService);

      // Add consumer tenants and agreements
      const consumer1 = createMockTenant();
      const consumer2 = createMockTenant();
      await addOneTenant(consumer1);
      await addOneTenant(consumer2);

      // Add agreements for priority service
      const priorityAgreements = Array.from({ length: 5 }, () =>
        createMockAgreement(priorityService.id, consumer1.id, {
          descriptorId: priorityService.descriptors[0].id,
          producerId: priorityProducer.id,
        })
      );
      for (const agreement of priorityAgreements) {
        await addOneAgreement(agreement);
      }

      // Add agreements for regular service
      const regularAgreements = Array.from({ length: 10 }, () =>
        createMockAgreement(regularService.id, consumer2.id, {
          descriptorId: regularService.descriptors[0].id,
          producerId: regularProducer.id,
        })
      );
      for (const agreement of regularAgreements) {
        await addOneAgreement(agreement);
      }

      const result = await readModelService.getNewEservices([
        priorityProducer.id,
      ]);

      expect(result).toHaveLength(2);
      // Priority service should come first despite having fewer agreements
      expect(result[0].eserviceId).toBe(priorityService.id);
      expect(result[1].eserviceId).toBe(regularService.id);
    });

    test("should handle multiple priority producers correctly", async () => {
      const priorityProducer1 = createMockTenant();
      const priorityProducer2 = createMockTenant();
      const regularProducer = createMockTenant();

      await addOneTenant(priorityProducer1);
      await addOneTenant(priorityProducer2);
      await addOneTenant(regularProducer);

      const { eservice: service1 } = createRecentPublishedEService(
        priorityProducer1.id,
        1,
        3
      );
      const { eservice: service2 } = createRecentPublishedEService(
        priorityProducer2.id,
        1,
        7
      );
      const { eservice: service3 } = createRecentPublishedEService(
        regularProducer.id,
        1,
        15
      );

      await addOneEService(service1);
      await addOneEService(service2);
      await addOneEService(service3);

      // Add consumer and agreements
      const consumer = createMockTenant();
      await addOneTenant(consumer);

      // Add agreements with different counts
      const addAgreements = async (
        serviceId: EServiceId,
        producerId: TenantId,
        descriptorId: DescriptorId,
        count: number
      ): Promise<void> => {
        const agreements = Array.from({ length: count }, () =>
          createMockAgreement(serviceId, consumer.id, {
            descriptorId,
            producerId,
          })
        );
        for (const agreement of agreements) {
          await addOneAgreement(agreement);
        }
      };

      await addAgreements(
        service1.id,
        priorityProducer1.id,
        service1.descriptors[0].id,
        3
      );
      await addAgreements(
        service2.id,
        priorityProducer2.id,
        service2.descriptors[0].id,
        7
      );
      await addAgreements(
        service3.id,
        regularProducer.id,
        service3.descriptors[0].id,
        15
      );

      const result = await readModelService.getNewEservices([
        priorityProducer1.id,
        priorityProducer2.id,
      ]);

      expect(result).toHaveLength(3);

      // Both priority producers should come first, ordered by agreement count
      expect(result[0].eserviceId).toBe(service2.id); // Priority with more agreements
      expect(result[1].eserviceId).toBe(service1.id); // Priority with fewer agreements
      expect(result[2].eserviceId).toBe(service3.id); // Regular producer last
    });
  });

  describe("Agreement counting", () => {
    test("should correctly count agreements for each EService", async () => {
      const producer = createMockTenant();
      const consumer1 = createMockTenant();
      const consumer2 = createMockTenant();

      await addOneTenant(producer);
      await addOneTenant(consumer1);
      await addOneTenant(consumer2);

      const { eservice } = createRecentPublishedEService(producer.id, 1, 0);
      await addOneEService(eservice);

      // Add multiple agreements
      const agreement1 = createMockAgreement(eservice.id, consumer1.id, {
        descriptorId: eservice.descriptors[0].id,
        producerId: producer.id,
      });
      const agreement2 = createMockAgreement(eservice.id, consumer2.id, {
        descriptorId: eservice.descriptors[0].id,
        producerId: producer.id,
      });

      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);

      const result = await readModelService.getNewEservices([]);

      expect(result).toHaveLength(1);
      expect(result[0].agreementCount).toBe(2);
    });
  });

  describe("Ordering and sorting", () => {
    test("should order by priority, then agreement count, then publish date", async () => {
      const testData = await setupTestData();

      const result = await readModelService.getNewEservices(
        testData.priorityProducers
      );

      expect(result).toHaveLength(3); // Only recent services, not the old one

      // First should be priority service with most agreements
      const firstService = result.find(
        (s) => s.eserviceId === testData.services.priorityService1.id
      );
      expect(firstService).toBeDefined();
      if (firstService) {
        expect(firstService.agreementCount).toBe(5);
      }

      // Regular service with most agreements should come after priority services
      const regularService = result.find(
        (s) => s.eserviceId === testData.services.regularService.id
      );
      expect(regularService).toBeDefined();
      if (regularService) {
        expect(regularService.agreementCount).toBe(10);
      }

      // Verify the order: priority services first regardless of agreement count
      const priorityService1Index = result.findIndex(
        (s) => s.eserviceId === testData.services.priorityService1.id
      );
      const priorityService2Index = result.findIndex(
        (s) => s.eserviceId === testData.services.priorityService2.id
      );
      const regularServiceIndex = result.findIndex(
        (s) => s.eserviceId === testData.services.regularService.id
      );

      expect(priorityService1Index).toBeLessThan(regularServiceIndex);
      expect(priorityService2Index).toBeLessThan(regularServiceIndex);
    });
  });

  describe("Limit and pagination", () => {
    test("should return the top 5 most relevant services based on ordering criteria", async () => {
      const priorityProducer = createMockTenant();
      const regularProducer = createMockTenant();
      await addOneTenant(priorityProducer);
      await addOneTenant(regularProducer);

      // Create multiple services with different agreement counts
      const priorityServices = Array.from({ length: 2 }, (_, i) => {
        const { eservice } = createRecentPublishedEService(
          priorityProducer.id,
          i + 1,
          i + 1
        );
        return { eservice, isPriority: true, agreements: i + 1 };
      });

      const regularServices = Array.from({ length: 5 }, (_, i) => {
        const { eservice } = createRecentPublishedEService(
          regularProducer.id,
          i + 1,
          (i + 1) * 10
        );
        return { eservice, isPriority: false, agreements: (i + 1) * 10 };
      });

      const services = [...priorityServices, ...regularServices];

      // Add all EServices to database
      for (const service of services) {
        await addOneEService(service.eservice);
      }

      // Add consumer and agreements
      const consumer = createMockTenant();
      await addOneTenant(consumer);

      for (const service of services) {
        const agreements = Array.from({ length: service.agreements }, () =>
          createMockAgreement(service.eservice.id, consumer.id, {
            descriptorId: service.eservice.descriptors[0].id,
            producerId: service.isPriority
              ? priorityProducer.id
              : regularProducer.id,
          })
        );
        for (const agreement of agreements) {
          await addOneAgreement(agreement);
        }
      }

      const result = await readModelService.getNewEservices([
        priorityProducer.id,
      ]);

      expect(result).toHaveLength(5);

      // First 2 should be priority services
      expect(result[0].agreementCount).toBeLessThanOrEqual(2);
      expect(result[1].agreementCount).toBeLessThanOrEqual(2);

      // Remaining 3 should be the top regular services by agreement count
      expect(result[2].agreementCount).toBeGreaterThan(
        result[3].agreementCount
      );
      expect(result[3].agreementCount).toBeGreaterThan(
        result[4].agreementCount
      );
    });
  });

  describe("Edge cases", () => {
    test("should handle empty priority producer list", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const { eservice } = createRecentPublishedEService(producer.id, 1, 0);
      await addOneEService(eservice);

      const result = await readModelService.getNewEservices([]);

      expect(result).toHaveLength(1);
      expect(result[0].eserviceId).toBe(eservice.id);
    });

    test("should handle services with multiple descriptors (only published ones)", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const publishedDescriptor = createMockDescriptor(
        descriptorState.published,
        new Date()
      );
      const draftDescriptor = createMockDescriptor(descriptorState.draft);

      const eservice = createMockEService(producer.id, {
        descriptors: [draftDescriptor, publishedDescriptor], // Mixed states
      });

      await addOneEService(eservice);

      const result = await readModelService.getNewEservices([]);

      expect(result).toHaveLength(1);
      expect(result[0].eserviceDescriptorId).toBe(publishedDescriptor.id);
    });

    test("should handle services with null publishedAt dates", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const descriptor = {
        ...createMockDescriptor(descriptorState.published),
        publishedAt: undefined, // Null publishedAt
      };

      const eservice = createMockEService(producer.id, {
        descriptors: [descriptor],
      });

      await addOneEService(eservice);

      const result = await readModelService.getNewEservices([]);

      // Should not be included due to isNotNull condition
      expect(result).toHaveLength(0);
    });
  });

  describe("Data integrity and types", () => {
    test("should return correctly typed results", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const { eservice } = createRecentPublishedEService(producer.id, 1, 0);
      await addOneEService(eservice);

      const result = await readModelService.getNewEservices([]);

      expect(result).toHaveLength(1);
      const item = result[0];

      expect(typeof item.eserviceId).toBe("string");
      expect(typeof item.eserviceDescriptorId).toBe("string");
      expect(typeof item.eserviceName).toBe("string");
      expect(typeof item.eserviceProducerId).toBe("string");
      expect(typeof item.agreementCount).toBe("number");
      expect(typeof item.totalCount).toBe("number");

      expect(item.agreementCount).toBeGreaterThanOrEqual(0);
      expect(item.totalCount).toBeGreaterThan(0);
    });
  });
});

describe("ReadModelService - getNewVersionEservices", () => {
  // eslint-disable-next-line functional/no-let
  let consumer: Tenant;

  beforeEach(async () => {
    consumer = createMockTenant();
    await addOneTenant(consumer);
  });

  describe("Basic functionality", () => {
    test("should return empty array when consumer has no agreements", async () => {
      const result = await readModelService.getNewVersionEservices(consumer.id);
      expect(result).toEqual([]);
    });

    test("should return empty array when no newer versions exist within time window", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      // Create EService with version 1, published 2 days ago
      const eservice = createEServiceWithVersions(producer.id, [
        { version: "1", daysAgo: 2 },
      ]);
      await addOneEService(eservice);

      // Consumer has agreement to version 1
      const agreement = createConsumerAgreement(
        consumer.id,
        eservice.id,
        eservice.descriptors[0].id,
        producer.id
      );
      await addOneAgreement(agreement);

      // No newer versions exist
      const result = await readModelService.getNewVersionEservices(consumer.id);
      expect(result).toEqual([]);
    });

    test("should return newer versions of subscribed EServices within 7-day window", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      // Create EService with versions 1 and 2
      const eservice = createEServiceWithVersions(producer.id, [
        { version: "1", daysAgo: 5 }, // Old version
        { version: "2", daysAgo: 1 }, // New version published 1 day ago
      ]);
      await addOneEService(eservice);

      // Consumer has agreement to version 1
      const agreement = createConsumerAgreement(
        consumer.id,
        eservice.id,
        eservice.descriptors[0].id, // version 1
        producer.id
      );
      await addOneAgreement(agreement);

      const result = await readModelService.getNewVersionEservices(consumer.id);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        eserviceId: eservice.id,
        eserviceDescriptorId: eservice.descriptors[1].id, // version 2
        eserviceName: eservice.name,
        eserviceProducerId: producer.id,
      });
    });
  });

  describe("Version comparison logic", () => {
    test("should correctly identify higher version numbers", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      // Test single digit comparison
      const eservice1 = createEServiceWithVersions(producer.id, [
        { version: "1", daysAgo: 5 },
        { version: "2", daysAgo: 1 },
      ]);
      await addOneEService(eservice1);

      const agreement1 = createConsumerAgreement(
        consumer.id,
        eservice1.id,
        eservice1.descriptors[0].id,
        producer.id
      );
      await addOneAgreement(agreement1);

      const result = await readModelService.getNewVersionEservices(consumer.id);
      expect(result).toHaveLength(1);
      expect(result[0].eserviceDescriptorId).toBe(eservice1.descriptors[1].id);
    });

    test("should handle multi-digit version comparisons properly", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithVersions(producer.id, [
        { version: "9", daysAgo: 5 },
        { version: "10", daysAgo: 1 },
      ]);
      await addOneEService(eservice);

      const agreement = createConsumerAgreement(
        consumer.id,
        eservice.id,
        eservice.descriptors[0].id, // version 9
        producer.id
      );
      await addOneAgreement(agreement);

      const result = await readModelService.getNewVersionEservices(consumer.id);

      expect(result).toHaveLength(1);
      expect(result[0].eserviceDescriptorId).toBe(eservice.descriptors[1].id); // version 10
    });
  });

  describe("Agreement and time filtering", () => {
    test("should only consider the specified consumer's active agreements", async () => {
      const producer = createMockTenant();
      const otherConsumer = createMockTenant();
      await addOneTenant(producer);
      await addOneTenant(otherConsumer);

      const eservice = createEServiceWithVersions(producer.id, [
        { version: "1", daysAgo: 3 },
        { version: "2", daysAgo: 1 },
      ]);
      await addOneEService(eservice);

      // Other consumer has agreement, but we query for our consumer
      const otherAgreement = createConsumerAgreement(
        otherConsumer.id,
        eservice.id,
        eservice.descriptors[0].id,
        producer.id
      );
      await addOneAgreement(otherAgreement);

      const result = await readModelService.getNewVersionEservices(consumer.id);
      expect(result).toEqual([]);
    });

    test("should only return descriptors published within last 7 days", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithVersions(producer.id, [
        { version: "1", daysAgo: 5 },
        { version: "2", daysAgo: 10 }, // Old new version, outside 7-day window
      ]);
      await addOneEService(eservice);

      const agreement = createConsumerAgreement(
        consumer.id,
        eservice.id,
        eservice.descriptors[0].id,
        producer.id
      );
      await addOneAgreement(agreement);

      const result = await readModelService.getNewVersionEservices(consumer.id);
      expect(result).toEqual([]);
    });
  });

  describe("Complex scenarios", () => {
    test("should handle consumer with agreements to multiple EServices", async () => {
      const producer1 = createMockTenant();
      const producer2 = createMockTenant();
      await addOneTenant(producer1);
      await addOneTenant(producer2);

      // First EService with new version
      const eservice1 = createEServiceWithVersions(producer1.id, [
        { version: "1", daysAgo: 4 },
        { version: "2", daysAgo: 1 },
      ]);
      await addOneEService(eservice1);

      // Second EService with new version
      const eservice2 = createEServiceWithVersions(producer2.id, [
        { version: "3", daysAgo: 3 },
        { version: "4", daysAgo: 2 },
      ]);
      await addOneEService(eservice2);

      // Consumer has agreements to both
      const agreement1 = createConsumerAgreement(
        consumer.id,
        eservice1.id,
        eservice1.descriptors[0].id,
        producer1.id
      );
      const agreement2 = createConsumerAgreement(
        consumer.id,
        eservice2.id,
        eservice2.descriptors[0].id,
        producer2.id
      );

      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);

      const result = await readModelService.getNewVersionEservices(consumer.id);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.eserviceId)).toEqual(
        expect.arrayContaining([eservice1.id, eservice2.id])
      );
    });

    test("should handle EService with multiple new versions", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithVersions(producer.id, [
        { version: "1", daysAgo: 5 }, // Consumer's version
        { version: "2", daysAgo: 3 }, // New version 1
        { version: "3", daysAgo: 1 }, // New version 2
      ]);
      await addOneEService(eservice);

      const agreement = createConsumerAgreement(
        consumer.id,
        eservice.id,
        eservice.descriptors[0].id, // version 1
        producer.id
      );
      await addOneAgreement(agreement);

      const result = await readModelService.getNewVersionEservices(consumer.id);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.eserviceDescriptorId)).toEqual(
        expect.arrayContaining([
          eservice.descriptors[1].id, // version 2
          eservice.descriptors[2].id, // version 3
        ])
      );
    });

    test("should respect the 5-item limit", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      // Create multiple EServices to exceed the limit
      const eserviceCount = 7;
      const eservices = await Promise.all(
        Array.from({ length: eserviceCount }, async () => {
          const eservice = createEServiceWithVersions(producer.id, [
            { version: "1", daysAgo: 4 },
            { version: "2", daysAgo: 1 },
          ]);
          await addOneEService(eservice);
          return eservice;
        })
      );

      // Create agreements for each EService
      await Promise.all(
        eservices.map(async (eservice) => {
          const agreement = createConsumerAgreement(
            consumer.id,
            eservice.id,
            eservice.descriptors[0].id,
            producer.id
          );
          await addOneAgreement(agreement);
        })
      );

      const result = await readModelService.getNewVersionEservices(consumer.id);
      expect(result).toHaveLength(5); // Should be limited to 5
    });
  });

  describe("Data integrity", () => {
    test("should return correctly typed results with proper counts and metadata", async () => {
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithVersions(producer.id, [
        { version: "1", daysAgo: 3 },
        { version: "2", daysAgo: 1 },
      ]);
      await addOneEService(eservice);

      const agreement = createConsumerAgreement(
        consumer.id,
        eservice.id,
        eservice.descriptors[0].id,
        producer.id
      );
      await addOneAgreement(agreement);

      const result = await readModelService.getNewVersionEservices(consumer.id);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        eserviceId: expect.any(String),
        eserviceDescriptorId: expect.any(String),
        eserviceName: expect.any(String),
        eserviceProducerId: expect.any(String),
        agreementCount: expect.any(Number),
        totalCount: expect.any(Number),
      });

      expect(result[0].eserviceId).toBe(eservice.id);
      expect(result[0].eserviceDescriptorId).toBe(eservice.descriptors[1].id);
      expect(result[0].eserviceName).toBe(eservice.name);
      expect(result[0].eserviceProducerId).toBe(producer.id);
    });
  });
});
