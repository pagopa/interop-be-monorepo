/* eslint-disable functional/no-let */
import { describe, it, expect } from "vitest";
import {
  getMockAgreement,
  getMockTenant,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementStamp,
  AgreementStamps,
  agreementState,
  descriptorState,
  EService,
  generateId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  daysAgo,
  readModelService,
  TEST_TIME_WINDOWS,
} from "./integrationUtils.js";

/**
 * Creates an agreement stamp at a specific time
 */
const createStamp = (date: Date): AgreementStamp => ({
  who: generateId<UserId>(),
  when: date,
});

/**
 * Creates an agreement with appropriate stamps based on state.
 * For sent agreements (consumer is protagonist):
 * - Active: needs activation stamp (producer accepted)
 * - Rejected: needs rejection stamp (producer rejected)
 * - Suspended: needs suspensionByProducer stamp (producer suspended)
 *
 * For received agreements (producer is protagonist):
 * - Pending: needs submission stamp (consumer submitted)
 */
const createAgreementWithStamps = (
  producerId: TenantId,
  consumerId: TenantId,
  eservice: EService,
  state: Agreement["state"],
  actionDate: Date
): Agreement => {
  const submissionStamp = createStamp(daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE));

  // Build stamps based on state (immutable approach)
  const getStamps = (): AgreementStamps => {
    switch (state) {
      case agreementState.active:
        return {
          submission: submissionStamp,
          activation: createStamp(actionDate),
        };
      case agreementState.rejected:
        return {
          submission: submissionStamp,
          rejection: createStamp(actionDate),
        };
      case agreementState.suspended:
        return {
          submission: submissionStamp,
          suspensionByProducer: createStamp(actionDate),
        };
      case agreementState.pending:
        // For pending, we use the submission stamp date as the action date
        return {
          submission: createStamp(actionDate),
        };
      case agreementState.draft:
      case agreementState.archived:
      case agreementState.missingCertifiedAttributes:
        return {
          submission: submissionStamp,
        };
    }
  };

  return {
    ...getMockAgreement(eservice.id, consumerId, state),
    producerId,
    descriptorId: eservice.descriptors[0].id,
    stamps: getStamps(),
  };
};

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

describe("ReadModelService - getSentAgreements", async () => {
  describe("Basic functionality - Consumer is the protagonist who sent the request", () => {
    it("should return empty array when no agreements exist for the consumer", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results).toEqual([]);
    });

    it("should return empty array when agreements exist but action date is outside time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      // Create agreement with activation stamp outside the time window (10 days ago)
      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.active,
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results).toEqual([]);
    });

    it("should return agreements with Active state within time window (using activation stamp)", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const activationDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.active,
        activationDate
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results.length).toBe(1);
      expect(results[0].agreementId).toBe(agreement.id);
      expect(results[0].state).toBe(agreementState.active);
    });

    it("should return agreements with Rejected state within time window (using rejection stamp)", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const rejectionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.rejected,
        rejectionDate
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results.length).toBe(1);
      expect(results[0].agreementId).toBe(agreement.id);
      expect(results[0].state).toBe(agreementState.rejected);
    });

    it("should return agreements with Suspended state within time window (using suspensionByProducer stamp)", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const suspensionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.suspended,
        suspensionDate
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results.length).toBe(1);
      expect(results[0].agreementId).toBe(agreement.id);
      expect(results[0].state).toBe(agreementState.suspended);
    });
  });

  describe("State filtering", () => {
    it("should not return agreements with Draft state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.draft,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results).toEqual([]);
    });

    it("should not return agreements with Pending state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.pending,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results).toEqual([]);
    });

    it("should return agreements with multiple valid states", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      // Create one agreement for each valid state
      const activeAgreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.active,
        daysAgo(3)
      );
      const rejectedAgreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.rejected,
        daysAgo(2)
      );
      const suspendedAgreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.suspended,
        daysAgo(1)
      );

      await addOneAgreement(activeAgreement);
      await addOneAgreement(rejectedAgreement);
      await addOneAgreement(suspendedAgreement);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results.length).toBe(3);
      expect(results.map((r) => r.state)).toContain(agreementState.active);
      expect(results.map((r) => r.state)).toContain(agreementState.rejected);
      expect(results.map((r) => r.state)).toContain(agreementState.suspended);
    });
  });

  describe("Limit and pagination", () => {
    it("should limit results to 5 per state for each state type", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      // Create 7 agreements for each state from different producers
      const states = [
        agreementState.active,
        agreementState.rejected,
        agreementState.suspended,
      ];

      for (const state of states) {
        for (let i = 0; i < 7; i++) {
          const producer = getMockTenant();
          await addOneTenant(producer);
          const eservice = createMockEServiceWithDescriptor(producer.id);
          await addOneEService(eservice);
          const agreement = createAgreementWithStamps(
            producer.id,
            consumer.id,
            eservice,
            state,
            daysAgo(i + 1)
          );
          await addOneAgreement(agreement);
        }
      }

      const results = await readModelService.getSentAgreements(consumer.id);

      const activeResults = results.filter(
        (r) => r.state === agreementState.active
      );
      const rejectedResults = results.filter(
        (r) => r.state === agreementState.rejected
      );
      const suspendedResults = results.filter(
        (r) => r.state === agreementState.suspended
      );

      expect(activeResults.length).toBe(5);
      expect(rejectedResults.length).toBe(5);
      expect(suspendedResults.length).toBe(5);
      expect(results.length).toBe(15); // 5 per state * 3 states
    });

    it("should return fewer than 5 when less agreements exist for a state", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      // Create only 3 Active agreements
      for (let i = 0; i < 3; i++) {
        const producer = getMockTenant();
        await addOneTenant(producer);
        const eservice = createMockEServiceWithDescriptor(producer.id);
        await addOneEService(eservice);
        const agreement = createAgreementWithStamps(
          producer.id,
          consumer.id,
          eservice,
          agreementState.active,
          daysAgo(i + 1)
        );
        await addOneAgreement(agreement);
      }

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results.length).toBe(3);
    });
  });

  describe("Ordering and sorting", () => {
    it("should order results by action date ascending", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      // Create agreements with different activation dates from different producers
      const producer1 = getMockTenant();
      const producer2 = getMockTenant();
      const producer3 = getMockTenant();
      await addOneTenant(producer1);
      await addOneTenant(producer2);
      await addOneTenant(producer3);

      const eservice1 = createMockEServiceWithDescriptor(producer1.id);
      const eservice2 = createMockEServiceWithDescriptor(producer2.id);
      const eservice3 = createMockEServiceWithDescriptor(producer3.id);
      await addOneEService(eservice1);
      await addOneEService(eservice2);
      await addOneEService(eservice3);

      const oldestAgreement = createAgreementWithStamps(
        producer1.id,
        consumer.id,
        eservice1,
        agreementState.active,
        daysAgo(5)
      );
      const middleAgreement = createAgreementWithStamps(
        producer2.id,
        consumer.id,
        eservice2,
        agreementState.active,
        daysAgo(3)
      );
      const newestAgreement = createAgreementWithStamps(
        producer3.id,
        consumer.id,
        eservice3,
        agreementState.active,
        daysAgo(1)
      );

      // Add in random order
      await addOneAgreement(newestAgreement);
      await addOneAgreement(oldestAgreement);
      await addOneAgreement(middleAgreement);

      const results = await readModelService.getSentAgreements(consumer.id);

      expect(results.length).toBe(3);
      expect(results[0].agreementId).toBe(oldestAgreement.id);
      expect(results[1].agreementId).toBe(middleAgreement.id);
      expect(results[2].agreementId).toBe(newestAgreement.id);
    });
  });

  describe("Consumer filtering", () => {
    it("should only return agreements for the specified consumer", async () => {
      const producer = getMockTenant();
      const consumer1 = getMockTenant();
      const consumer2 = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer1);
      await addOneTenant(consumer2);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const agreement1 = createAgreementWithStamps(
        producer.id,
        consumer1.id,
        eservice,
        agreementState.active,
        daysAgo(2)
      );
      const agreement2 = createAgreementWithStamps(
        producer.id,
        consumer2.id,
        eservice,
        agreementState.active,
        daysAgo(2)
      );

      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);

      const results = await readModelService.getSentAgreements(consumer1.id);

      expect(results.length).toBe(1);
      expect(results[0].agreementId).toBe(agreement1.id);
    });
  });

  describe("Total count per state", () => {
    it("should return totalCount specific to each state, not the total across all states", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      // Create 7 Active, 3 Rejected, and 5 Suspended agreements
      const activeCount = 7;
      const rejectedCount = 3;
      const suspendedCount = 5;

      // Create Active agreements
      for (let i = 0; i < activeCount; i++) {
        const producer = getMockTenant();
        await addOneTenant(producer);
        const eservice = createMockEServiceWithDescriptor(producer.id);
        await addOneEService(eservice);
        const agreement = createAgreementWithStamps(
          producer.id,
          consumer.id,
          eservice,
          agreementState.active,
          daysAgo(i + 1)
        );
        await addOneAgreement(agreement);
      }

      // Create Rejected agreements
      for (let i = 0; i < rejectedCount; i++) {
        const producer = getMockTenant();
        await addOneTenant(producer);
        const eservice = createMockEServiceWithDescriptor(producer.id);
        await addOneEService(eservice);
        const agreement = createAgreementWithStamps(
          producer.id,
          consumer.id,
          eservice,
          agreementState.rejected,
          daysAgo(i + 1)
        );
        await addOneAgreement(agreement);
      }

      // Create Suspended agreements
      for (let i = 0; i < suspendedCount; i++) {
        const producer = getMockTenant();
        await addOneTenant(producer);
        const eservice = createMockEServiceWithDescriptor(producer.id);
        await addOneEService(eservice);
        const agreement = createAgreementWithStamps(
          producer.id,
          consumer.id,
          eservice,
          agreementState.suspended,
          daysAgo(i + 1)
        );
        await addOneAgreement(agreement);
      }

      const results = await readModelService.getSentAgreements(consumer.id);

      // Verify we got results for all states
      const activeResults = results.filter(
        (r) => r.state === agreementState.active
      );
      const rejectedResults = results.filter(
        (r) => r.state === agreementState.rejected
      );
      const suspendedResults = results.filter(
        (r) => r.state === agreementState.suspended
      );

      // Each state should have its own totalCount (not the sum of all)
      // Active: 7 total, but limited to 5 returned
      expect(activeResults.length).toBe(5);
      expect(activeResults[0].totalCount).toBe(activeCount); // 7

      // Rejected: 3 total, all returned
      expect(rejectedResults.length).toBe(rejectedCount);
      expect(rejectedResults[0].totalCount).toBe(rejectedCount); // 3

      // Suspended: 5 total, all returned
      expect(suspendedResults.length).toBe(suspendedCount);
      expect(suspendedResults[0].totalCount).toBe(suspendedCount); // 5
    });

    it("should maintain consistent totalCount across all returned items of the same state", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      // Create 7 Active agreements (more than the limit of 5, all within time window)
      // Using smaller day increments to stay within the 7-day time window
      const totalActive = 7;
      for (let i = 0; i < totalActive; i++) {
        const producer = getMockTenant();
        await addOneTenant(producer);
        const eservice = createMockEServiceWithDescriptor(producer.id);
        await addOneEService(eservice);
        // Use fractional days to create distinct timestamps within the time window
        const hoursAgo = (i + 1) * 12; // 12h, 24h, 36h, 48h, 60h, 72h, 84h (all within 7 days)
        const actionDate = new Date();
        actionDate.setHours(actionDate.getHours() - hoursAgo);
        const agreement = createAgreementWithStamps(
          producer.id,
          consumer.id,
          eservice,
          agreementState.active,
          actionDate
        );
        await addOneAgreement(agreement);
      }

      const results = await readModelService.getSentAgreements(consumer.id);
      const activeResults = results.filter(
        (r) => r.state === agreementState.active
      );

      // Should return only 5 (the limit)
      expect(activeResults.length).toBe(5);

      // All 5 returned items should have totalCount = 7 (the actual total within time window)
      for (const result of activeResults) {
        expect(result.totalCount).toBe(totalActive);
      }
    });

    it("should return correct totalCount per state even when counts differ significantly (4 accepted, 16 suspended, 4 rejected)", async () => {
      const consumer = getMockTenant();
      await addOneTenant(consumer);

      const acceptedCount = 4;
      const suspendedCount = 16;
      const rejectedCount = 4;

      // Helper to create agreements for a specific state
      const createAgreementsForState = async (
        count: number,
        state:
          | typeof agreementState.active
          | typeof agreementState.suspended
          | typeof agreementState.rejected
      ): Promise<void> => {
        for (let i = 0; i < count; i++) {
          const producer = getMockTenant();
          await addOneTenant(producer);
          const eservice = createMockEServiceWithDescriptor(producer.id);
          await addOneEService(eservice);
          // Use hours to create distinct timestamps within the 7-day time window
          const hoursAgo = (i + 1) * 8; // 8h, 16h, 24h, etc. (all within 7 days = 168h)
          const actionDate = new Date();
          actionDate.setHours(actionDate.getHours() - hoursAgo);
          const agreement = createAgreementWithStamps(
            producer.id,
            consumer.id,
            eservice,
            state,
            actionDate
          );
          await addOneAgreement(agreement);
        }
      };

      // Create agreements for each state
      await createAgreementsForState(acceptedCount, agreementState.active);
      await createAgreementsForState(suspendedCount, agreementState.suspended);
      await createAgreementsForState(rejectedCount, agreementState.rejected);

      const results = await readModelService.getSentAgreements(consumer.id);

      // Filter results by state
      const activeResults = results.filter(
        (r) => r.state === agreementState.active
      );
      const suspendedResults = results.filter(
        (r) => r.state === agreementState.suspended
      );
      const rejectedResults = results.filter(
        (r) => r.state === agreementState.rejected
      );

      // Accepted: 4 total, all returned, totalCount = 4
      expect(activeResults.length).toBe(acceptedCount);
      expect(activeResults[0].totalCount).toBe(acceptedCount);

      // Suspended: 16 total, only 5 returned (limit), but totalCount = 16
      expect(suspendedResults.length).toBe(5);
      expect(suspendedResults[0].totalCount).toBe(suspendedCount);
      // Verify all returned suspended items have the same totalCount
      for (const result of suspendedResults) {
        expect(result.totalCount).toBe(suspendedCount);
      }

      // Rejected: 4 total, all returned, totalCount = 4
      expect(rejectedResults.length).toBe(rejectedCount);
      expect(rejectedResults[0].totalCount).toBe(rejectedCount);
    });
  });
});

describe("ReadModelService - getReceivedAgreements", async () => {
  describe("Basic functionality - Producer is the protagonist who received the request", () => {
    it("should return empty array when no agreements exist for the producer", async () => {
      const producer = getMockTenant();
      await addOneTenant(producer);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results).toEqual([]);
    });

    it("should return empty array when agreements exist but submission date is outside time window", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      // Create agreement with submission stamp outside the time window (10 days ago)
      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.pending,
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results).toEqual([]);
    });

    it("should return agreements with Pending state within time window (using submission stamp)", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const submissionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.pending,
        submissionDate
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results.length).toBe(1);
      expect(results[0].agreementId).toBe(agreement.id);
    });
  });

  describe("State filtering - Only Pending state should be returned", () => {
    it("should not return agreements with Active state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.active,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results).toEqual([]);
    });

    it("should not return agreements with Rejected state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.rejected,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results).toEqual([]);
    });

    it("should not return agreements with Suspended state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.suspended,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results).toEqual([]);
    });

    it("should not return agreements with Draft state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.draft,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results).toEqual([]);
    });

    it("should not return agreements with Archived state", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      const agreement = createAgreementWithStamps(
        producer.id,
        consumer.id,
        eservice,
        agreementState.archived,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneAgreement(agreement);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results).toEqual([]);
    });
  });

  describe("Limit and pagination", () => {
    it("should limit results to 5", async () => {
      const producer = getMockTenant();
      await addOneTenant(producer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      // Create 7 pending agreements from different consumers
      for (let i = 0; i < 7; i++) {
        const consumer = getMockTenant();
        await addOneTenant(consumer);
        const agreement = createAgreementWithStamps(
          producer.id,
          consumer.id,
          eservice,
          agreementState.pending,
          daysAgo(i + 1)
        );
        await addOneAgreement(agreement);
      }

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results.length).toBe(5);
    });

    it("should return fewer than 5 when less agreements exist", async () => {
      const producer = getMockTenant();
      await addOneTenant(producer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      // Create only 3 pending agreements
      for (let i = 0; i < 3; i++) {
        const consumer = getMockTenant();
        await addOneTenant(consumer);
        const agreement = createAgreementWithStamps(
          producer.id,
          consumer.id,
          eservice,
          agreementState.pending,
          daysAgo(i + 1)
        );
        await addOneAgreement(agreement);
      }

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results.length).toBe(3);
    });
  });

  describe("Ordering and sorting", () => {
    it("should order results by submission date ascending", async () => {
      const producer = getMockTenant();
      await addOneTenant(producer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      // Create agreements with different submission dates from different consumers
      const consumer1 = getMockTenant();
      const consumer2 = getMockTenant();
      const consumer3 = getMockTenant();
      await addOneTenant(consumer1);
      await addOneTenant(consumer2);
      await addOneTenant(consumer3);

      const oldestAgreement = createAgreementWithStamps(
        producer.id,
        consumer1.id,
        eservice,
        agreementState.pending,
        daysAgo(5)
      );
      const middleAgreement = createAgreementWithStamps(
        producer.id,
        consumer2.id,
        eservice,
        agreementState.pending,
        daysAgo(3)
      );
      const newestAgreement = createAgreementWithStamps(
        producer.id,
        consumer3.id,
        eservice,
        agreementState.pending,
        daysAgo(1)
      );

      // Add in random order
      await addOneAgreement(newestAgreement);
      await addOneAgreement(oldestAgreement);
      await addOneAgreement(middleAgreement);

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results.length).toBe(3);
      expect(results[0].agreementId).toBe(oldestAgreement.id);
      expect(results[1].agreementId).toBe(middleAgreement.id);
      expect(results[2].agreementId).toBe(newestAgreement.id);
    });
  });

  describe("Producer filtering", () => {
    it("should only return agreements for the specified producer", async () => {
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

      const agreement1 = createAgreementWithStamps(
        producer1.id,
        consumer.id,
        eservice1,
        agreementState.pending,
        daysAgo(2)
      );
      const agreement2 = createAgreementWithStamps(
        producer2.id,
        consumer.id,
        eservice2,
        agreementState.pending,
        daysAgo(2)
      );

      await addOneAgreement(agreement1);
      await addOneAgreement(agreement2);

      const results = await readModelService.getReceivedAgreements(
        producer1.id
      );

      expect(results.length).toBe(1);
      expect(results[0].agreementId).toBe(agreement1.id);
    });
  });

  describe("Data integrity", () => {
    it("should include total count in results", async () => {
      const producer = getMockTenant();
      await addOneTenant(producer);

      const eservice = createMockEServiceWithDescriptor(producer.id);
      await addOneEService(eservice);

      // Create 3 pending agreements from different consumers
      for (let i = 0; i < 3; i++) {
        const consumer = getMockTenant();
        await addOneTenant(consumer);
        const agreement = createAgreementWithStamps(
          producer.id,
          consumer.id,
          eservice,
          agreementState.pending,
          daysAgo(i + 1)
        );
        await addOneAgreement(agreement);
      }

      const results = await readModelService.getReceivedAgreements(producer.id);

      expect(results.length).toBe(3);
      // Total count should reflect the database count before filtering
      expect(results[0].totalCount).toBeGreaterThanOrEqual(3);
    });
  });
});
