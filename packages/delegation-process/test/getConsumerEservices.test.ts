import {
  getMockAgreement,
  getMockDelegation,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  generateId,
  delegationKind,
  delegationState,
  agreementState,
  TenantId,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEservice,
  delegationService,
} from "./utils.js";

describe("getConsumerEservices", () => {
  const delegatorId1 = generateId<TenantId>();
  const delegatorId2 = generateId<TenantId>();
  const delegatorId3 = generateId<TenantId>();
  const delegateId = generateId<TenantId>();
  const delegateId2 = generateId<TenantId>();
  const delegateId3 = generateId<TenantId>();

  const eservice1 = { ...getMockEService(), name: "Servizio 1" };
  const eservice2 = { ...getMockEService(), name: "Servizio 2" };
  const eservice3 = { ...getMockEService(), name: "PagoPaService" };
  const eservice4 = { ...getMockEService(), name: "Pippo" };
  const eservice5 = { ...getMockEService(), name: "Paperino" };
  const eservice6 = getMockEService();

  const mockDelegation1 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId,
    delegatorId: delegatorId1,
    eserviceId: eservice1.id,
  });

  const mockAgreement1 = {
    ...getMockAgreement(eservice1.id, delegatorId1, agreementState.active),
    producerId: eservice1.producerId,
  };

  const mockDelegation1Bis = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId,
    delegatorId: delegatorId1,
    eserviceId: eservice2.id,
  });

  const mockAgreement1bis = {
    ...getMockAgreement(eservice2.id, delegatorId1, agreementState.active),
    producerId: eservice2.producerId,
  };

  // Delegator1 has 2 active delegations and 2 active agreements

  const mockDelegation2 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId,
    delegatorId: delegatorId2,
    eserviceId: eservice1.id,
  });

  const mockAgreement2 = {
    ...getMockAgreement(eservice1.id, delegatorId2, agreementState.active),
    producerId: eservice1.producerId,
  };

  // Delegator2 has 1 active delegation and 1 active agreement

  const mockDelegation3 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.rejected,
    delegateId,
    delegatorId: delegatorId3,
    eserviceId: eservice1.id,
  });

  // Delegator3 has 1 rejected delegation

  const mockDelegation4 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId,
    delegatorId: delegatorId4,
    eserviceId: eservice1.id,
  });

  const mockAgreement4 = {
    ...getMockAgreement(eservice1.id, delegatorId4, agreementState.rejected),
    producerId: eservice1.producerId,
  };

  // Delegator4 has 1 active delegation and 1 rejected agreement

  const mockDelegation5 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId,
    delegatorId: delegatorId5,
    eserviceId: eservice3.id,
  });

  const mockAgreement5 = {
    ...getMockAgreement(eservice3.id, delegatorId5, agreementState.active),
    producerId: eservice3.producerId,
  };

  // Delegator5 has 1 active delegation and 1 active agreement

  const mockDelegation6 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    state: delegationState.active,
    delegateId: generateId<TenantId>(),
    delegatorId: delegatorId6,
    eserviceId: eservice3.id,
  });

  const mockAgreement6 = {
    ...getMockAgreement(eservice3.id, delegatorId6, agreementState.active),
    producerId: eservice3.producerId,
  };

  // Delegator6 has 1 active delegation and 1 active agreement but a different delegateId

  beforeEach(async () => {
    await addOneEservice(eservice1);
    await addOneEservice(eservice2);
    await addOneEservice(eservice3);
    await addOneDelegation(mockDelegation1);
    await addOneDelegation(mockDelegation1Bis);
    await addOneDelegation(mockDelegation2);
    await addOneDelegation(mockDelegation3);
    await addOneDelegation(mockDelegation4);
    await addOneDelegation(mockDelegation5);
    await addOneDelegation(mockDelegation6);
    await addOneAgreement(mockAgreement1);
    await addOneAgreement(mockAgreement1bis);
    await addOneAgreement(mockAgreement2);
    await addOneAgreement(mockAgreement4);
    await addOneAgreement(mockAgreement5);
    await addOneAgreement(mockAgreement6);
  });

  it("should get delegators filtered by delegateId", async () => {
    expect(
      await delegationService.getConsumerDelegators(
        {
          delegateId,
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          id: delegatorId1,
          name: delegator1.name,
        },
        {
          id: delegatorId2,
          name: delegator2.name,
        },
        {
          id: delegatorId5,
          name: delegator5.name,
        },
      ],
      pagination: {
        totalCount: 3,
        offset: 0,
        limit: 50,
      },
    });
  });
  it("should apply offset and limit", async () => {
    expect(
      await delegationService.getConsumerDelegators(
        {
          delegateId,
          offset: 1,
          limit: 1,
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          id: delegatorId2,
          name: delegator2.name,
        },
      ],
      pagination: {
        totalCount: 3,
        offset: 1,
        limit: 1,
      },
    });
  });
  it("should filter delegators by the 'delegatorName' parameter", async () => {
    expect(
      await delegationService.getConsumerDelegators(
        {
          delegateId,
          offset: 0,
          limit: 50,
          delegatorName: "Comune",
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          id: delegatorId1,
          name: delegator1.name,
        },
        {
          id: delegatorId2,
          name: delegator2.name,
        },
      ],
      pagination: {
        totalCount: 2,
        offset: 0,
        limit: 50,
      },
    });

    expect(
      await delegationService.getConsumerDelegators(
        {
          delegateId,
          offset: 0,
          limit: 50,
          delegatorName: "PagoPA",
        },
        genericLogger
      )
    ).toEqual({
      results: [
        {
          id: delegatorId5,
          name: delegator5.name,
        },
      ],
      pagination: {
        totalCount: 1,
        offset: 0,
        limit: 50,
      },
    });
  });
  it("should return no results if no delegations match the criteria", async () => {
    expect(
      await delegationService.getConsumerDelegators(
        {
          delegateId: generateId<TenantId>(),
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [],
      pagination: {
        totalCount: 0,
        offset: 0,
        limit: 50,
      },
    });

    expect(
      await delegationService.getConsumerDelegators(
        {
          delegateId: delegatorId3, // No active delegation
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [],
      pagination: {
        totalCount: 0,
        offset: 0,
        limit: 50,
      },
    });

    expect(
      await delegationService.getConsumerDelegators(
        {
          delegateId: delegatorId4, // No active agreements
          offset: 0,
          limit: 50,
        },
        genericLogger
      )
    ).toEqual({
      results: [],
      pagination: {
        totalCount: 0,
        offset: 0,
        limit: 50,
      },
    });
  });
});
