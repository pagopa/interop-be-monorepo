/* eslint-disable functional/no-let */
import { describe, it, expect } from "vitest";
import {
  getMockTenant,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  EService,
  purposeVersionState,
  TenantId,
} from "pagopa-interop-models";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  createPurposeWithVersion,
  daysAgo,
  readModelService,
  TEST_TIME_WINDOWS,
} from "./integrationUtils.js";

/**
 * Creates a mock EService with a published descriptor
 */
const createMockEServiceWithDescriptor = (producerId: TenantId): EService => ({
  ...getMockEService(),
  producerId,
  descriptors: [
    {
      ...getMockDescriptor(),
      state: descriptorState.published,
      publishedAt: new Date(),
    },
  ],
});

describe("ReadModelService - getSentPurposes", async () => {
  describe("Basic functionality - Consumer is the protagonist who sent the purpose", () => {
    it("should return empty array when no purposes exist for the consumer", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      const results = await readModelService.getSentPurposes(consumer.id);

      expect(results).toEqual([]);
    });

    it("should return empty array when purposes exist but action date is outside time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.active,
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getSentPurposes(consumer.id);

      expect(results).toEqual([]);
    });

    it("should return purposes with Active state within time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const actionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.active,
        actionDate
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getSentPurposes(consumer.id);

      expect(results.length).toBe(1);
      expect(results[0].purposeId).toBe(purpose.id);
      expect(results[0].state).toBe(purposeVersionState.active);
    });

    it("should return purposes with Rejected state within time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const actionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.rejected,
        actionDate
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getSentPurposes(consumer.id);

      expect(results.length).toBe(1);
      expect(results[0].purposeId).toBe(purpose.id);
      expect(results[0].state).toBe(purposeVersionState.rejected);
    });

    it("should return purposes with WaitingForApproval state within time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const actionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.waitingForApproval,
        actionDate
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getSentPurposes(consumer.id);

      expect(results.length).toBe(1);
      expect(results[0].purposeId).toBe(purpose.id);
      expect(results[0].state).toBe(purposeVersionState.waitingForApproval);
    });
  });

  describe("State filtering", () => {
    it("should not return purposes with Draft state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.draft,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getSentPurposes(consumer.id);

      expect(results).toEqual([]);
    });

    it("should not return purposes with Suspended state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.suspended,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getSentPurposes(consumer.id);

      expect(results).toEqual([]);
    });

    it("should return purposes with multiple valid states", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const activePurpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.active,
        daysAgo(3)
      );
      const rejectedPurpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.rejected,
        daysAgo(2)
      );
      const waitingPurpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.waitingForApproval,
        daysAgo(1)
      );

      await addOnePurpose(activePurpose);
      await addOnePurpose(rejectedPurpose);
      await addOnePurpose(waitingPurpose);

      const results = await readModelService.getSentPurposes(consumer.id);

      expect(results.length).toBe(3);
      expect(results.map((r) => r.state)).toContain(purposeVersionState.active);
      expect(results.map((r) => r.state)).toContain(
        purposeVersionState.rejected
      );
      expect(results.map((r) => r.state)).toContain(
        purposeVersionState.waitingForApproval
      );
    });
  });

  describe("Limit and pagination", () => {
    it("should limit results to 5 per state", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      const states = [
        purposeVersionState.active,
        purposeVersionState.rejected,
        purposeVersionState.waitingForApproval,
      ];

      for (const state of states) {
        for (let i = 0; i < 7; i++) {
          const producer = getMockTenant();
          await addOneTenant(producer);
          const eservice = createMockEServiceWithDescriptor(producer.id);
          await addOneEService(eservice);
          const purpose = createPurposeWithVersion(
            consumer.id,
            eservice.id,
            state,
            daysAgo(i + 1)
          );
          await addOnePurpose(purpose);
        }
      }

      const results = await readModelService.getSentPurposes(consumer.id);

      const activeResults = results.filter(
        (r) => r.state === purposeVersionState.active
      );
      const rejectedResults = results.filter(
        (r) => r.state === purposeVersionState.rejected
      );
      const waitingResults = results.filter(
        (r) => r.state === purposeVersionState.waitingForApproval
      );

      expect(activeResults.length).toBe(5);
      expect(rejectedResults.length).toBe(5);
      expect(waitingResults.length).toBe(5);
      expect(results.length).toBe(15);
    });
  });

  describe("Consumer filtering", () => {
    it("should only return purposes for the specified consumer", async () => {
      const producer = getMockTenant();
      const consumer1 = getMockTenant();
      const consumer2 = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer1);
      await addOneTenant(consumer2);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose1 = createPurposeWithVersion(
        consumer1.id,
        eservice.id,
        purposeVersionState.active,
        daysAgo(2)
      );
      const purpose2 = createPurposeWithVersion(
        consumer2.id,
        eservice.id,
        purposeVersionState.active,
        daysAgo(2)
      );

      await addOnePurpose(purpose1);
      await addOnePurpose(purpose2);

      const results = await readModelService.getSentPurposes(consumer1.id);

      expect(results.length).toBe(1);
      expect(results[0].purposeId).toBe(purpose1.id);
    });
  });

  describe("Total count per state", () => {
    it("should return totalCount specific to each state", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      const activeCount = 7;
      const rejectedCount = 3;
      const waitingCount = 5;

      // Create Active purposes
      for (let i = 0; i < activeCount; i++) {
        const producer = getMockTenant();
        await addOneTenant(producer);
        const eservice = createMockEServiceWithDescriptor(producer.id);
        await addOneEService(eservice);
        const hoursAgo = (i + 1) * 12;
        const actionDate = new Date();
        actionDate.setHours(actionDate.getHours() - hoursAgo);
        const purpose = createPurposeWithVersion(
          consumer.id,
          eservice.id,
          purposeVersionState.active,
          actionDate
        );
        await addOnePurpose(purpose);
      }

      // Create Rejected purposes
      for (let i = 0; i < rejectedCount; i++) {
        const producer = getMockTenant();
        await addOneTenant(producer);
        const eservice = createMockEServiceWithDescriptor(producer.id);
        await addOneEService(eservice);
        const hoursAgo = (i + 1) * 12;
        const actionDate = new Date();
        actionDate.setHours(actionDate.getHours() - hoursAgo);
        const purpose = createPurposeWithVersion(
          consumer.id,
          eservice.id,
          purposeVersionState.rejected,
          actionDate
        );
        await addOnePurpose(purpose);
      }

      // Create WaitingForApproval purposes
      for (let i = 0; i < waitingCount; i++) {
        const producer = getMockTenant();
        await addOneTenant(producer);
        const eservice = createMockEServiceWithDescriptor(producer.id);
        await addOneEService(eservice);
        const hoursAgo = (i + 1) * 12;
        const actionDate = new Date();
        actionDate.setHours(actionDate.getHours() - hoursAgo);
        const purpose = createPurposeWithVersion(
          consumer.id,
          eservice.id,
          purposeVersionState.waitingForApproval,
          actionDate
        );
        await addOnePurpose(purpose);
      }

      const results = await readModelService.getSentPurposes(consumer.id);

      const activeResults = results.filter(
        (r) => r.state === purposeVersionState.active
      );
      const rejectedResults = results.filter(
        (r) => r.state === purposeVersionState.rejected
      );
      const waitingResults = results.filter(
        (r) => r.state === purposeVersionState.waitingForApproval
      );

      // Active: 7 total, limited to 5 returned
      expect(activeResults.length).toBe(5);
      expect(activeResults[0].totalCount).toBe(activeCount);

      // Rejected: 3 total, all returned
      expect(rejectedResults.length).toBe(rejectedCount);
      expect(rejectedResults[0].totalCount).toBe(rejectedCount);

      // WaitingForApproval: 5 total, all returned
      expect(waitingResults.length).toBe(waitingCount);
      expect(waitingResults[0].totalCount).toBe(waitingCount);
    });
  });
});

describe("ReadModelService - getReceivedPurposes", async () => {
  describe("Basic functionality - Producer is the protagonist who received the purpose", () => {
    it("should return empty array when no purposes exist for the producer", async () => {
      const producer = getMockTenant();
      await addOneTenant(producer);

      const results = await readModelService.getReceivedPurposes(producer.id);

      expect(results).toEqual([]);
    });

    it("should return empty array when purposes exist but action date is outside time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.active,
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getReceivedPurposes(producer.id);

      expect(results).toEqual([]);
    });

    it("should return purposes with Active state within time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const actionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.active,
        actionDate
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getReceivedPurposes(producer.id);

      expect(results.length).toBe(1);
      expect(results[0].purposeId).toBe(purpose.id);
      expect(results[0].state).toBe(purposeVersionState.active);
    });

    it("should return purposes with WaitingForApproval state within time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const actionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.waitingForApproval,
        actionDate
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getReceivedPurposes(producer.id);

      expect(results.length).toBe(1);
      expect(results[0].purposeId).toBe(purpose.id);
      expect(results[0].state).toBe(purposeVersionState.waitingForApproval);
    });
  });

  describe("State filtering - Only Active and WaitingForApproval should be returned", () => {
    it("should not return purposes with Rejected state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.rejected,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getReceivedPurposes(producer.id);

      expect(results).toEqual([]);
    });

    it("should not return purposes with Draft state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.draft,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getReceivedPurposes(producer.id);

      expect(results).toEqual([]);
    });

    it("should not return purposes with Suspended state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.suspended,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getReceivedPurposes(producer.id);

      expect(results).toEqual([]);
    });
  });

  describe("Consumer exclusion", () => {
    it("should return purposes where producer is also the consumer (autofruizione)", async () => {
      const tenant = getMockTenant();
      await addOneTenant(tenant);

      // Tenant is both producer and consumer (autofruizione)
      const eservice = createMockEServiceWithDescriptor(tenant.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        tenant.id, // consumer is same as producer
        eservice.id,
        purposeVersionState.active,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getReceivedPurposes(tenant.id);

      expect(results.length).toBe(1);
      expect(results[0].consumerId).toBe(tenant.id);
    });

    it("should return purposes from different consumers", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const purpose = createPurposeWithVersion(
        consumer.id, // different from producer
        eservice.id,
        purposeVersionState.active,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOnePurpose(purpose);

      const results = await readModelService.getReceivedPurposes(producer.id);

      expect(results.length).toBe(1);
      expect(results[0].consumerId).toBe(consumer.id);
    });
  });

  describe("Limit and pagination", () => {
    it("should limit results to 5 per state", async () => {
      const producer = getMockTenant();
      await addOneTenant(producer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const states = [
        purposeVersionState.active,
        purposeVersionState.waitingForApproval,
      ];

      for (const state of states) {
        for (let i = 0; i < 7; i++) {
          const consumer = getMockTenant();
          await addOneTenant(consumer);
          const purpose = createPurposeWithVersion(
            consumer.id,
            eservice.id,
            state,
            daysAgo(i + 1)
          );
          await addOnePurpose(purpose);
        }
      }

      const results = await readModelService.getReceivedPurposes(producer.id);

      const activeResults = results.filter(
        (r) => r.state === purposeVersionState.active
      );
      const waitingResults = results.filter(
        (r) => r.state === purposeVersionState.waitingForApproval
      );

      expect(activeResults.length).toBe(5);
      expect(waitingResults.length).toBe(5);
      expect(results.length).toBe(10);
    });
  });

  describe("Producer filtering", () => {
    it("should only return purposes for e-services owned by the specified producer", async () => {
      const producer1 = getMockTenant();
      const producer2 = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer1);
      await addOneTenant(producer2);
      await addOneTenant(consumer);

      const eservice1 = createMockEServiceWithDescriptor(producer1.id);
      const eservice2 = createMockEServiceWithDescriptor(producer2.id);
      await addOneEService(eservice1);
      await addOneEService(eservice2);

      const purpose1 = createPurposeWithVersion(
        consumer.id,
        eservice1.id,
        purposeVersionState.active,
        daysAgo(2)
      );
      const purpose2 = createPurposeWithVersion(
        consumer.id,
        eservice2.id,
        purposeVersionState.active,
        daysAgo(2)
      );

      await addOnePurpose(purpose1);
      await addOnePurpose(purpose2);

      const results = await readModelService.getReceivedPurposes(producer1.id);

      expect(results.length).toBe(1);
      expect(results[0].purposeId).toBe(purpose1.id);
    });
  });

  describe("Total count per state", () => {
    it("should return totalCount specific to each state", async () => {
      const producer = getMockTenant();
      await addOneTenant(producer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const activeCount = 7;
      const waitingCount = 4;

      // Create Active purposes
      for (let i = 0; i < activeCount; i++) {
        const consumer = getMockTenant();
        await addOneTenant(consumer);
        const hoursAgo = (i + 1) * 12;
        const actionDate = new Date();
        actionDate.setHours(actionDate.getHours() - hoursAgo);
        const purpose = createPurposeWithVersion(
          consumer.id,
          eservice.id,
          purposeVersionState.active,
          actionDate
        );
        await addOnePurpose(purpose);
      }

      // Create WaitingForApproval purposes
      for (let i = 0; i < waitingCount; i++) {
        const consumer = getMockTenant();
        await addOneTenant(consumer);
        const hoursAgo = (i + 1) * 12;
        const actionDate = new Date();
        actionDate.setHours(actionDate.getHours() - hoursAgo);
        const purpose = createPurposeWithVersion(
          consumer.id,
          eservice.id,
          purposeVersionState.waitingForApproval,
          actionDate
        );
        await addOnePurpose(purpose);
      }

      const results = await readModelService.getReceivedPurposes(producer.id);

      const activeResults = results.filter(
        (r) => r.state === purposeVersionState.active
      );
      const waitingResults = results.filter(
        (r) => r.state === purposeVersionState.waitingForApproval
      );

      // Active: 7 total, limited to 5 returned
      expect(activeResults.length).toBe(5);
      expect(activeResults[0].totalCount).toBe(activeCount);

      // WaitingForApproval: 4 total, all returned
      expect(waitingResults.length).toBe(waitingCount);
      expect(waitingResults[0].totalCount).toBe(waitingCount);
    });
  });
});
