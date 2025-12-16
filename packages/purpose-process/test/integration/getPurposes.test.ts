import {
  EService,
  Purpose,
  PurposeTemplateId,
  TenantId,
  delegationKind,
  delegationState,
  generateId,
  purposeVersionState,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  getMockDelegation,
  getMockAuthData,
  getMockContext,
  getMockEService,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  expectSinglePageListResult,
  purposeService,
} from "../integrationUtils.js";

describe("getPurposes", async () => {
  const producerId1: TenantId = generateId();
  const producerId2: TenantId = generateId();
  const consumerId1: TenantId = generateId();
  const consumerId2: TenantId = generateId();
  const delegateProducerId1: TenantId = generateId();
  const delegateConsumerId1: TenantId = generateId();
  const delegateConsumerId2: TenantId = generateId();

  const mockEService1ByTenant1: EService = {
    ...getMockEService(),
    producerId: producerId1,
    name: "eService 1",
  };

  const mockEService2ByTenant1: EService = {
    ...getMockEService(),
    producerId: producerId1,
    name: "eService 2",
  };

  const mockEService3ByTenant2: EService = {
    ...getMockEService(),
    producerId: producerId2,
    name: "eService 3",
  };

  const mockEService4 = getMockEService();

  const mockPurpose1: Purpose = {
    ...getMockPurpose(),
    title: "purpose 1 - test",
    consumerId: consumerId1,
    eserviceId: mockEService1ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.draft)],
    purposeTemplateId: generateId<PurposeTemplateId>(),
  };

  const mockPurpose2: Purpose = {
    ...getMockPurpose(),
    title: "purpose 2",
    consumerId: consumerId2,
    eserviceId: mockEService1ByTenant1.id,
  };

  const mockPurpose3: Purpose = {
    ...getMockPurpose(),
    title: "purpose 3 - test",
    consumerId: consumerId1,
    eserviceId: mockEService2ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.suspended)],
  };

  const mockPurpose4: Purpose = {
    ...getMockPurpose(),
    title: "purpose 4",
    consumerId: consumerId2,
    eserviceId: mockEService3ByTenant2.id,
    versions: [getMockPurposeVersion(purposeVersionState.rejected)],
  };

  const mockPurpose5: Purpose = {
    ...getMockPurpose(),
    title: "purpose 5",
    eserviceId: mockEService4.id,
    versions: [getMockPurposeVersion(purposeVersionState.waitingForApproval)],
  };

  const mockPurpose6: Purpose = {
    ...getMockPurpose(),
    title: "purpose 6 - test",
    consumerId: consumerId1,
    eserviceId: mockEService3ByTenant2.id,
    versions: [
      getMockPurposeVersion(purposeVersionState.archived),
      getMockPurposeVersion(purposeVersionState.active),
    ],
  };

  const mockPurpose7: Purpose = {
    ...getMockPurpose(),
    title: "purpose 7 - test",
    versions: [],
    eserviceId: mockEService4.id,
  };

  const producerDelegation1 = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    delegateId: delegateProducerId1,
    delegatorId: producerId1,
    eserviceId: mockEService1ByTenant1.id,
    state: delegationState.active,
  });
  const consumerDelegation1 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    delegateId: delegateConsumerId1,
    delegatorId: consumerId1,
    eserviceId: mockEService1ByTenant1.id,
    state: delegationState.active,
  });
  const consumerDelegation2 = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    delegateId: delegateConsumerId2,
    delegatorId: consumerId2,
    eserviceId: mockEService3ByTenant2.id,
    state: delegationState.active,
  });

  const mockDelegatedPurpose1: Purpose = {
    ...getMockPurpose(),
    title: "purpose 8 - delegated purpose 1",
    consumerId: consumerId1,
    eserviceId: mockEService1ByTenant1.id,
    versions: [getMockPurposeVersion(purposeVersionState.active)],
    delegationId: consumerDelegation1.id,
  };

  const mockDelegatedPurpose2: Purpose = {
    ...getMockPurpose(),
    title: "purpose 9 - delegated purpose 2",
    consumerId: consumerId2,
    eserviceId: mockEService3ByTenant2.id,
    versions: [getMockPurposeVersion(purposeVersionState.active)],
    delegationId: consumerDelegation2.id,
  };

  // These delegations are revoked: the delegates
  // should not see the corresponding agreements
  const revokedProducerDelegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    delegateId: delegateProducerId1,
    delegatorId: mockEService1ByTenant1.producerId,
    eserviceId: mockEService1ByTenant1.id,
    state: delegationState.revoked,
  });
  const revokedConsumerDelegation = getMockDelegation({
    kind: delegationKind.delegatedConsumer,
    delegateId: delegateConsumerId1,
    delegatorId: consumerId1,
    eserviceId: mockEService1ByTenant1.id,
    state: delegationState.revoked,
  });

  beforeEach(async () => {
    await addOnePurpose(mockPurpose1);
    await addOnePurpose(mockPurpose2);
    await addOnePurpose(mockPurpose3);
    await addOnePurpose(mockPurpose4);
    await addOnePurpose(mockPurpose5);
    await addOnePurpose(mockPurpose6);
    await addOnePurpose(mockPurpose7);
    await addOnePurpose(mockDelegatedPurpose1);
    await addOnePurpose(mockDelegatedPurpose2);

    await addOneEService(mockEService1ByTenant1);
    await addOneEService(mockEService2ByTenant1);
    await addOneEService(mockEService3ByTenant2);
    await addOneEService(mockEService4);

    await addOneDelegation(producerDelegation1);
    await addOneDelegation(consumerDelegation1);
    await addOneDelegation(consumerDelegation2);
    await addOneDelegation(revokedProducerDelegation);
    await addOneDelegation(revokedConsumerDelegation);
  });

  it("should get all purposes visible to consumer/producer requester if no filters are provided", async () => {
    const allPurposesVisibleToProducer1 = await purposeService.getPurposes(
      {
        title: undefined,
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(allPurposesVisibleToProducer1, [
      mockPurpose1,
      mockPurpose2,
      mockPurpose3,
      mockDelegatedPurpose1,
    ]);

    const allPurposesVisibleToProducer2 = await purposeService.getPurposes(
      {
        title: undefined,
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId2) })
    );

    expectSinglePageListResult(allPurposesVisibleToProducer2, [
      mockPurpose4,
      mockPurpose6,
      mockDelegatedPurpose2,
    ]);

    const allPurposesVisibleToConsumer1 = await purposeService.getPurposes(
      {
        title: undefined,
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(consumerId1) })
    );

    expectSinglePageListResult(allPurposesVisibleToConsumer1, [
      mockPurpose1,
      mockPurpose3,
      mockPurpose6,
      mockDelegatedPurpose1,
    ]);

    const allPurposesVisibleToConsumer2 = await purposeService.getPurposes(
      {
        title: undefined,
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(consumerId2) })
    );

    expectSinglePageListResult(allPurposesVisibleToConsumer2, [
      mockPurpose2,
      mockPurpose4,
      mockDelegatedPurpose2,
    ]);
  });

  it("should get all purposes visible to delegate producer requester if no filters are provided", async () => {
    const allPurposesVisibleToDelegateProducer1 =
      await purposeService.getPurposes(
        {
          title: undefined,
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(delegateProducerId1) })
      );

    expectSinglePageListResult(allPurposesVisibleToDelegateProducer1, [
      mockPurpose1,
      mockPurpose2,
      mockDelegatedPurpose1,
    ]);
  });

  it("should get all purposes visible to delegate consumer requester if no filters are provided", async () => {
    const allPurposesVisibleToDelegateConsumer1 =
      await purposeService.getPurposes(
        {
          title: undefined,
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(delegateConsumerId1) })
      );

    expectSinglePageListResult(allPurposesVisibleToDelegateConsumer1, [
      mockDelegatedPurpose1,
    ]);

    const allPurposesVisibleToDelegateConsumer2 =
      await purposeService.getPurposes(
        {
          title: undefined,
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(delegateConsumerId2) })
      );

    expectSinglePageListResult(allPurposesVisibleToDelegateConsumer2, [
      mockDelegatedPurpose2,
    ]);
  });

  it("should get purposes with filters: name", async () => {
    const result = await purposeService.getPurposes(
      {
        title: "test",
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(result, [mockPurpose1, mockPurpose3]);
  });

  it("should get purposes with filters: eservicesIds", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [mockEService1ByTenant1.id],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(result, [
      mockPurpose1,
      mockPurpose2,
      mockDelegatedPurpose1,
    ]);
  });

  it("should get purposes with filters: consumersIds", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [consumerId1],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );
    expect(result.totalCount).toBe(3);

    expectSinglePageListResult(result, [
      mockPurpose1,
      mockPurpose3,
      mockDelegatedPurpose1,
    ]);
  });

  it("should get purposes with filters: eservicesIds, consumerIds", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [mockEService1ByTenant1.id],
        consumersIds: [consumerId2],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(result, [mockPurpose2]);
  });

  it("should get purposes with filters: producersIds", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [producerId1],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(result, [
      mockPurpose1,
      mockPurpose2,
      mockPurpose3,
      mockDelegatedPurpose1,
    ]);
  });

  it("should get purposes with filters: states", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [purposeVersionState.draft, purposeVersionState.active],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );
    expectSinglePageListResult(result, [mockPurpose1, mockDelegatedPurpose1]);

    const result2 = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [
          purposeVersionState.archived,
          purposeVersionState.active,
          purposeVersionState.rejected,
        ],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId2) })
    );
    expectSinglePageListResult(result2, [
      mockPurpose4,
      mockPurpose6,
      mockDelegatedPurpose2,
    ]);
  });

  it("should get purposes with only archived versions (and exclude the ones with both archived and non-archived versions)", async () => {
    const mockArchivedPurpose: Purpose = {
      ...getMockPurpose(),
      title: "archived purpose",
      eserviceId: mockEService1ByTenant1.id,
      versions: [getMockPurposeVersion(purposeVersionState.archived)],
    };

    const mockArchivedAndActivePurpose: Purpose = {
      ...getMockPurpose(),
      title: "archived and active purpose",
      eserviceId: mockEService1ByTenant1.id,
      versions: [
        getMockPurposeVersion(purposeVersionState.archived),
        getMockPurposeVersion(purposeVersionState.active),
      ],
    };

    await addOnePurpose(mockArchivedPurpose);
    await addOnePurpose(mockArchivedAndActivePurpose);

    const result = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [purposeVersionState.archived],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(result, [mockArchivedPurpose]);
  });

  it("should not include purpose without versions or with one draft version (excludeDraft = true)", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: true,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );
    expectSinglePageListResult(result, [mockPurpose3, mockDelegatedPurpose1]);
  });

  it("should include purpose without versions or with one draft version (excludeDraft = false)", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(result, [
      mockPurpose1,
      mockPurpose2,
      mockPurpose3,
      mockDelegatedPurpose1,
    ]);
  });

  it("should get purposes (pagination: offset)", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 2, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expect({
      ...result,
      results: result.results.map(sortPurpose),
    }).toEqual({
      totalCount: 4,
      results: [mockPurpose3, mockDelegatedPurpose1].map(sortPurpose),
    });
  });

  it("should get purposes (pagination: limit)", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 2 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expect({
      ...result,
      results: result.results.map(sortPurpose),
    }).toEqual({
      totalCount: 4,
      results: [mockPurpose1, mockPurpose2].map(sortPurpose),
    });
  });

  it("should not get purposes if they don't exist", async () => {
    const result = await purposeService.getPurposes(
      {
        eservicesIds: [generateId()],
        consumersIds: [],
        producersIds: [generateId()],
        states: [],
        excludeDraft: undefined,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expect(result).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should get purposes with filters: name, eservicesIds, consumersIds, producersIds, states; excludeDraft = true", async () => {
    const result = await purposeService.getPurposes(
      {
        title: "test",
        eservicesIds: [mockEService1ByTenant1.id, mockEService2ByTenant1.id],
        consumersIds: [consumerId1],
        producersIds: [producerId1],
        states: [purposeVersionState.draft, purposeVersionState.suspended],
        excludeDraft: true,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(result, [mockPurpose3]);
  });

  it("should get purposes with filters: name, eservicesIds, consumersIds, producersIds, states; excludeDraft = false", async () => {
    const result = await purposeService.getPurposes(
      {
        title: "test",
        eservicesIds: [mockEService1ByTenant1.id, mockEService2ByTenant1.id],
        consumersIds: [consumerId1],
        producersIds: [producerId1],
        states: [purposeVersionState.draft, purposeVersionState.suspended],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(producerId1) })
    );

    expectSinglePageListResult(result, [mockPurpose1, mockPurpose3]);
  });

  it("should get purposes with filters: producersIds with only producer delegate id", async () => {
    const results = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [delegateProducerId1],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(delegateProducerId1) })
    );

    expectSinglePageListResult(results, [
      mockPurpose1,
      mockPurpose2,
      mockDelegatedPurpose1,
    ]);
  });

  it("should get purposes with filters: producersIds that contains a producer delegate id and a generic producerId", async () => {
    const results = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [],
        producersIds: [delegateProducerId1, producerId2],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(delegateProducerId1) })
    );

    expectSinglePageListResult(results, [
      mockPurpose1,
      mockPurpose2,
      mockDelegatedPurpose1,
    ]);
  });

  it("should get purposes with filters: consumersIds with only consumer delegate id", async () => {
    const results = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [delegateConsumerId1],
        producersIds: [],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(delegateConsumerId1) })
    );

    expectSinglePageListResult(results, [mockDelegatedPurpose1]);
  });

  it("should get purposes with filters: consumersIds that contains a consumer delegate id and a generic consumerId", async () => {
    const results = await purposeService.getPurposes(
      {
        eservicesIds: [],
        consumersIds: [delegateConsumerId1, consumerId1],
        producersIds: [],
        states: [],
        excludeDraft: false,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(delegateConsumerId1) })
    );

    expectSinglePageListResult(results, [mockDelegatedPurpose1]);
  });
});
