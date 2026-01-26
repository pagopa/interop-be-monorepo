/* eslint-disable functional/no-let */
import { describe, it, expect } from "vitest";
import { getMockDelegation, getMockTenant } from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationKind,
  DelegationStamp,
  DelegationStamps,
  delegationKind,
  delegationState,
  EService,
  generateId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { upsertDelegation } from "pagopa-interop-readmodel/testUtils";
import {
  addOneEService,
  addOneTenant,
  createMockEService,
  daysAgo,
  readModelDB,
  readModelService,
  TEST_TIME_WINDOWS,
} from "./integrationUtils.js";

/**
 * Creates a delegation stamp at a specific time
 */
const createStamp = (date: Date): DelegationStamp => ({
  who: generateId<UserId>(),
  when: date,
});

/**
 * Creates a delegation with appropriate stamps based on state.
 * For sent delegations (delegator is protagonist):
 * - Active: needs activation stamp (delegate approved)
 * - Rejected: needs rejection stamp (delegate rejected)
 *
 * For received delegations (delegate is protagonist):
 * - WaitingForApproval: needs submission stamp (delegator submitted)
 * - Revoked: needs revocation stamp (delegator revoked)
 */
const createDelegationWithStamps = (params: {
  delegatorId: TenantId;
  delegateId: TenantId;
  eservice: EService;
  state: Delegation["state"];
  kind: DelegationKind;
  actionDate: Date;
}): Delegation => {
  const { delegatorId, delegateId, eservice, state, kind, actionDate } = params;
  const submissionStamp = createStamp(daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE));

  // Build stamps based on state (immutable approach)
  const getStamps = (): DelegationStamps => {
    switch (state) {
      case delegationState.active:
        return {
          submission: submissionStamp,
          activation: createStamp(actionDate),
        };
      case delegationState.rejected:
        return {
          submission: submissionStamp,
          rejection: createStamp(actionDate),
        };
      case delegationState.revoked:
        return {
          submission: submissionStamp,
          activation: createStamp(daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE)),
          revocation: createStamp(actionDate),
        };
      case delegationState.waitingForApproval:
        // For waiting for approval, we use the submission stamp date as the action date
        return {
          submission: createStamp(actionDate),
        };
    }
  };

  return getMockDelegation({
    kind,
    delegatorId,
    delegateId,
    eserviceId: eservice.id,
    state,
    stamps: getStamps(),
  });
};

/**
 * Adds a delegation to the database
 */
const addOneDelegation = async (delegation: Delegation): Promise<void> => {
  await upsertDelegation(readModelDB, delegation, 0);
};

describe("ReadModelService - getSentDelegations", async () => {
  describe("Basic functionality - Delegator is the protagonist who sent the delegation", () => {
    it("should return empty array when no delegations exist for the delegator", async () => {
      const delegator = getMockTenant();
      await addOneTenant(delegator);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results).toEqual([]);
    });

    it("should return empty array when delegations exist but action date is outside time window", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      // Create delegation with activation stamp outside the time window (10 days ago)
      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results).toEqual([]);
    });

    it("should return delegations with Active state within time window (using activation stamp)", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const activationDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: activationDate,
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results.length).toBe(1);
      expect(results[0].delegationId).toBe(delegation.id);
      expect(results[0].state).toBe(delegationState.active);
    });

    it("should return delegations with Rejected state within time window (using rejection stamp)", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const rejectionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.rejected,
        kind: delegationKind.delegatedConsumer,
        actionDate: rejectionDate,
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results.length).toBe(1);
      expect(results[0].delegationId).toBe(delegation.id);
      expect(results[0].state).toBe(delegationState.rejected);
    });

    it("should return delegation kind (producer/consumer)", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const activationDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.active,
        kind: delegationKind.delegatedConsumer,
        actionDate: activationDate,
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results.length).toBe(1);
      expect(results[0].delegationKind).toBe(delegationKind.delegatedConsumer);
    });
  });

  describe("State filtering", () => {
    it("should not return delegations with WaitingForApproval state", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results).toEqual([]);
    });

    it("should not return delegations with Revoked state", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.revoked,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results).toEqual([]);
    });

    it("should return delegations with multiple valid states", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      // Create one delegation for each valid state
      const activeDelegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(3),
      });
      const rejectedDelegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.rejected,
        kind: delegationKind.delegatedConsumer,
        actionDate: daysAgo(2),
      });

      await addOneDelegation(activeDelegation);
      await addOneDelegation(rejectedDelegation);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results.length).toBe(2);
      expect(results.map((r) => r.state)).toContain(delegationState.active);
      expect(results.map((r) => r.state)).toContain(delegationState.rejected);
    });
  });

  describe("Limit and pagination", () => {
    it("should limit results to 5 per state for each state type", async () => {
      const delegator = getMockTenant();
      await addOneTenant(delegator);

      const states = [delegationState.active, delegationState.rejected];

      for (const state of states) {
        for (let i = 0; i < 7; i++) {
          const delegate = getMockTenant();
          await addOneTenant(delegate);
          const eservice = createMockEService(delegator.id);
          await addOneEService(eservice);
          const delegation = createDelegationWithStamps({
            delegatorId: delegator.id,
            delegateId: delegate.id,
            eservice,
            state,
            kind: delegationKind.delegatedProducer,
            actionDate: daysAgo(i + 1),
          });
          await addOneDelegation(delegation);
        }
      }

      const results = await readModelService.getSentDelegations(delegator.id);

      const activeResults = results.filter(
        (r) => r.state === delegationState.active
      );
      const rejectedResults = results.filter(
        (r) => r.state === delegationState.rejected
      );

      expect(activeResults.length).toBe(5);
      expect(rejectedResults.length).toBe(5);
      expect(results.length).toBe(10); // 5 per state * 2 states
    });

    it("should return fewer than 5 when less delegations exist for a state", async () => {
      const delegator = getMockTenant();
      await addOneTenant(delegator);

      // Create only 3 Active delegations
      for (let i = 0; i < 3; i++) {
        const delegate = getMockTenant();
        await addOneTenant(delegate);
        const eservice = createMockEService(delegator.id);
        await addOneEService(eservice);
        const delegation = createDelegationWithStamps({
          delegatorId: delegator.id,
          delegateId: delegate.id,
          eservice,
          state: delegationState.active,
          kind: delegationKind.delegatedProducer,
          actionDate: daysAgo(i + 1),
        });
        await addOneDelegation(delegation);
      }

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results.length).toBe(3);
    });
  });

  describe("Ordering and sorting", () => {
    it("should order results by action date ascending (oldest first)", async () => {
      const delegator = getMockTenant();
      await addOneTenant(delegator);

      const delegate1 = getMockTenant();
      const delegate2 = getMockTenant();
      const delegate3 = getMockTenant();
      await addOneTenant(delegate1);
      await addOneTenant(delegate2);
      await addOneTenant(delegate3);

      const eservice1 = createMockEService(delegator.id);
      const eservice2 = createMockEService(delegator.id);
      const eservice3 = createMockEService(delegator.id);
      await addOneEService(eservice1);
      await addOneEService(eservice2);
      await addOneEService(eservice3);

      const oldestDelegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate1.id,
        eservice: eservice1,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(5),
      });
      const middleDelegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate2.id,
        eservice: eservice2,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(3),
      });
      const newestDelegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate3.id,
        eservice: eservice3,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(1),
      });

      // Add in random order
      await addOneDelegation(newestDelegation);
      await addOneDelegation(oldestDelegation);
      await addOneDelegation(middleDelegation);

      const results = await readModelService.getSentDelegations(delegator.id);

      expect(results.length).toBe(3);
      expect(results[0].delegationId).toBe(oldestDelegation.id);
      expect(results[1].delegationId).toBe(middleDelegation.id);
      expect(results[2].delegationId).toBe(newestDelegation.id);
    });
  });

  describe("Delegator filtering", () => {
    it("should only return delegations for the specified delegator", async () => {
      const delegator1 = getMockTenant();
      const delegator2 = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator1);
      await addOneTenant(delegator2);
      await addOneTenant(delegate);

      const eservice1 = createMockEService(delegator1.id);
      const eservice2 = createMockEService(delegator2.id);
      await addOneEService(eservice1);
      await addOneEService(eservice2);

      const delegation1 = createDelegationWithStamps({
        delegatorId: delegator1.id,
        delegateId: delegate.id,
        eservice: eservice1,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(2),
      });
      const delegation2 = createDelegationWithStamps({
        delegatorId: delegator2.id,
        delegateId: delegate.id,
        eservice: eservice2,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(2),
      });

      await addOneDelegation(delegation1);
      await addOneDelegation(delegation2);

      const results = await readModelService.getSentDelegations(delegator1.id);

      expect(results.length).toBe(1);
      expect(results[0].delegationId).toBe(delegation1.id);
    });
  });

  describe("Total count per state", () => {
    it("should return totalCount specific to each state", async () => {
      const delegator = getMockTenant();
      await addOneTenant(delegator);

      const activeCount = 7;
      const rejectedCount = 3;

      // Create Active delegations
      for (let i = 0; i < activeCount; i++) {
        const delegate = getMockTenant();
        await addOneTenant(delegate);
        const eservice = createMockEService(delegator.id);
        await addOneEService(eservice);
        const delegation = createDelegationWithStamps({
          delegatorId: delegator.id,
          delegateId: delegate.id,
          eservice,
          state: delegationState.active,
          kind: delegationKind.delegatedProducer,
          actionDate: daysAgo(i + 1),
        });
        await addOneDelegation(delegation);
      }

      // Create Rejected delegations
      for (let i = 0; i < rejectedCount; i++) {
        const delegate = getMockTenant();
        await addOneTenant(delegate);
        const eservice = createMockEService(delegator.id);
        await addOneEService(eservice);
        const delegation = createDelegationWithStamps({
          delegatorId: delegator.id,
          delegateId: delegate.id,
          eservice,
          state: delegationState.rejected,
          kind: delegationKind.delegatedConsumer,
          actionDate: daysAgo(i + 1),
        });
        await addOneDelegation(delegation);
      }

      const results = await readModelService.getSentDelegations(delegator.id);

      const activeResults = results.filter(
        (r) => r.state === delegationState.active
      );
      const rejectedResults = results.filter(
        (r) => r.state === delegationState.rejected
      );

      // Active: 7 total, but limited to 5 returned
      expect(activeResults.length).toBe(5);
      expect(activeResults[0].totalCount).toBe(activeCount);

      // Rejected: 3 total, all returned
      expect(rejectedResults.length).toBe(rejectedCount);
      expect(rejectedResults[0].totalCount).toBe(rejectedCount);
    });
  });
});

describe("ReadModelService - getReceivedDelegations", async () => {
  describe("Basic functionality - Delegate is the protagonist who received the delegation", () => {
    it("should return empty array when no delegations exist for the delegate", async () => {
      const delegate = getMockTenant();
      await addOneTenant(delegate);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results).toEqual([]);
    });

    it("should return empty array when delegations exist but action date is outside time window", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      // Create delegation with submission stamp outside the time window (10 days ago)
      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results).toEqual([]);
    });

    it("should return delegations with WaitingForApproval state within time window (using submission stamp)", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const submissionDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: submissionDate,
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results.length).toBe(1);
      expect(results[0].delegationId).toBe(delegation.id);
      expect(results[0].state).toBe(delegationState.waitingForApproval);
    });

    it("should return delegations with Revoked state within time window (using revocation stamp)", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const revocationDate = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE);
      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.revoked,
        kind: delegationKind.delegatedConsumer,
        actionDate: revocationDate,
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results.length).toBe(1);
      expect(results[0].delegationId).toBe(delegation.id);
      expect(results[0].state).toBe(delegationState.revoked);
    });
  });

  describe("State filtering - Only WaitingForApproval and Revoked states should be returned", () => {
    it("should not return delegations with Active state", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results).toEqual([]);
    });

    it("should not return delegations with Rejected state", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.rejected,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results).toEqual([]);
    });

    it("should return delegations with multiple valid states", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice1 = createMockEService(delegator.id);
      const eservice2 = createMockEService(delegator.id);
      await addOneEService(eservice1);
      await addOneEService(eservice2);

      const waitingDelegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice: eservice1,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(3),
      });
      const revokedDelegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice: eservice2,
        state: delegationState.revoked,
        kind: delegationKind.delegatedConsumer,
        actionDate: daysAgo(2),
      });

      await addOneDelegation(waitingDelegation);
      await addOneDelegation(revokedDelegation);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results.length).toBe(2);
      expect(results.map((r) => r.state)).toContain(
        delegationState.waitingForApproval
      );
      expect(results.map((r) => r.state)).toContain(delegationState.revoked);
    });
  });

  describe("Limit and pagination", () => {
    it("should limit results to 5 per state", async () => {
      const delegate = getMockTenant();
      await addOneTenant(delegate);

      const states = [
        delegationState.waitingForApproval,
        delegationState.revoked,
      ];

      for (const state of states) {
        for (let i = 0; i < 7; i++) {
          const delegator = getMockTenant();
          await addOneTenant(delegator);
          const eservice = createMockEService(delegator.id);
          await addOneEService(eservice);
          const delegation = createDelegationWithStamps({
            delegatorId: delegator.id,
            delegateId: delegate.id,
            eservice,
            state,
            kind: delegationKind.delegatedProducer,
            actionDate: daysAgo(i + 1),
          });
          await addOneDelegation(delegation);
        }
      }

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      const waitingResults = results.filter(
        (r) => r.state === delegationState.waitingForApproval
      );
      const revokedResults = results.filter(
        (r) => r.state === delegationState.revoked
      );

      expect(waitingResults.length).toBe(5);
      expect(revokedResults.length).toBe(5);
      expect(results.length).toBe(10);
    });

    it("should return fewer than 5 when less delegations exist", async () => {
      const delegate = getMockTenant();
      await addOneTenant(delegate);

      // Create only 3 WaitingForApproval delegations
      for (let i = 0; i < 3; i++) {
        const delegator = getMockTenant();
        await addOneTenant(delegator);
        const eservice = createMockEService(delegator.id);
        await addOneEService(eservice);
        const delegation = createDelegationWithStamps({
          delegatorId: delegator.id,
          delegateId: delegate.id,
          eservice,
          state: delegationState.waitingForApproval,
          kind: delegationKind.delegatedProducer,
          actionDate: daysAgo(i + 1),
        });
        await addOneDelegation(delegation);
      }

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results.length).toBe(3);
    });
  });

  describe("Ordering and sorting", () => {
    it("should order results by action date ascending (oldest first)", async () => {
      const delegate = getMockTenant();
      await addOneTenant(delegate);

      const delegator1 = getMockTenant();
      const delegator2 = getMockTenant();
      const delegator3 = getMockTenant();
      await addOneTenant(delegator1);
      await addOneTenant(delegator2);
      await addOneTenant(delegator3);

      const eservice1 = createMockEService(delegator1.id);
      const eservice2 = createMockEService(delegator2.id);
      const eservice3 = createMockEService(delegator3.id);
      await addOneEService(eservice1);
      await addOneEService(eservice2);
      await addOneEService(eservice3);

      const oldestDelegation = createDelegationWithStamps({
        delegatorId: delegator1.id,
        delegateId: delegate.id,
        eservice: eservice1,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(5),
      });
      const middleDelegation = createDelegationWithStamps({
        delegatorId: delegator2.id,
        delegateId: delegate.id,
        eservice: eservice2,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(3),
      });
      const newestDelegation = createDelegationWithStamps({
        delegatorId: delegator3.id,
        delegateId: delegate.id,
        eservice: eservice3,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(1),
      });

      // Add in random order
      await addOneDelegation(newestDelegation);
      await addOneDelegation(oldestDelegation);
      await addOneDelegation(middleDelegation);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results.length).toBe(3);
      expect(results[0].delegationId).toBe(oldestDelegation.id);
      expect(results[1].delegationId).toBe(middleDelegation.id);
      expect(results[2].delegationId).toBe(newestDelegation.id);
    });
  });

  describe("Delegate filtering", () => {
    it("should only return delegations for the specified delegate", async () => {
      const delegator = getMockTenant();
      const delegate1 = getMockTenant();
      const delegate2 = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate1);
      await addOneTenant(delegate2);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const delegation1 = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate1.id,
        eservice,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(2),
      });
      const delegation2 = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate2.id,
        eservice,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(2),
      });

      await addOneDelegation(delegation1);
      await addOneDelegation(delegation2);

      const results = await readModelService.getReceivedDelegations(
        delegate1.id
      );

      expect(results.length).toBe(1);
      expect(results[0].delegationId).toBe(delegation1.id);
    });
  });

  describe("Total count per state", () => {
    it("should return totalCount specific to each state", async () => {
      const delegate = getMockTenant();
      await addOneTenant(delegate);

      const waitingCount = 7;
      const revokedCount = 3;

      // Create WaitingForApproval delegations
      for (let i = 0; i < waitingCount; i++) {
        const delegator = getMockTenant();
        await addOneTenant(delegator);
        const eservice = createMockEService(delegator.id);
        await addOneEService(eservice);
        const delegation = createDelegationWithStamps({
          delegatorId: delegator.id,
          delegateId: delegate.id,
          eservice,
          state: delegationState.waitingForApproval,
          kind: delegationKind.delegatedProducer,
          actionDate: daysAgo(i + 1),
        });
        await addOneDelegation(delegation);
      }

      // Create Revoked delegations
      for (let i = 0; i < revokedCount; i++) {
        const delegator = getMockTenant();
        await addOneTenant(delegator);
        const eservice = createMockEService(delegator.id);
        await addOneEService(eservice);
        const delegation = createDelegationWithStamps({
          delegatorId: delegator.id,
          delegateId: delegate.id,
          eservice,
          state: delegationState.revoked,
          kind: delegationKind.delegatedConsumer,
          actionDate: daysAgo(i + 1),
        });
        await addOneDelegation(delegation);
      }

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      const waitingResults = results.filter(
        (r) => r.state === delegationState.waitingForApproval
      );
      const revokedResults = results.filter(
        (r) => r.state === delegationState.revoked
      );

      // WaitingForApproval: 7 total, but limited to 5 returned
      expect(waitingResults.length).toBe(5);
      expect(waitingResults[0].totalCount).toBe(waitingCount);

      // Revoked: 3 total, all returned
      expect(revokedResults.length).toBe(revokedCount);
      expect(revokedResults[0].totalCount).toBe(revokedCount);
    });
  });

  describe("Data integrity", () => {
    it("should include delegation name (eservice name) in results", async () => {
      const delegator = getMockTenant();
      const delegate = getMockTenant();
      await addOneTenant(delegator);
      await addOneTenant(delegate);

      const eservice = createMockEService(delegator.id);
      await addOneEService(eservice);

      const delegation = createDelegationWithStamps({
        delegatorId: delegator.id,
        delegateId: delegate.id,
        eservice,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        actionDate: daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
      });
      await addOneDelegation(delegation);

      const results = await readModelService.getReceivedDelegations(
        delegate.id
      );

      expect(results.length).toBe(1);
      expect(results[0].delegationName).toBe(eservice.name);
    });
  });
});
