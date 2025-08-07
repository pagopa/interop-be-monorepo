/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getMockDelegation,
  getMockAuthData,
  addSomeRandomDelegations,
  getMockAgreement,
  getMockTenant,
  randomArrayItem,
  getMockContext,
  getMockEService,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  PurposeVersionSuspendedByConsumerV2,
  toPurposeV2,
  PurposeVersionSuspendedByProducerV2,
  PurposeId,
  PurposeVersionId,
  TenantId,
  delegationState,
  delegationKind,
  Agreement,
  EService,
  eserviceMode,
  tenantKind,
  agreementState,
  DelegationId,
} from "pagopa-interop-models";
import {
  purposeNotFound,
  purposeVersionNotFound,
  tenantNotAllowed,
  notValidVersionState,
  tenantIsNotTheDelegatedProducer,
  tenantIsNotTheDelegate,
  purposeDelegationNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("suspendPurposeVersion", () => {
  const isSuspendable = [
    purposeVersionState.active,
    purposeVersionState.suspended,
  ];
  it.each(isSuspendable)(
    "should write on event-store for the suspension of a purpose version by the consumer",
    async (s) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockEService = getMockEService();
      const mockPurposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: s,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion1],
      };
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      const suspendResponse = await purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion1.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );

      const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeVersionSuspendedByConsumer",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion1,
            state: purposeVersionState.suspended,
            suspendedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        updatedAt: new Date(),
        suspendedByConsumer: true,
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionSuspendedByConsumerV2,
        payload: writtenEvent.data,
      });

      expect(sortPurpose(writtenPayload.purpose)).toEqual(
        sortPurpose(toPurposeV2(expectedPurpose))
      );
      expect(suspendResponse).toMatchObject({
        data: expectedPurpose.versions[0],
        metadata: { version: 1 },
      });

      vi.useRealTimers();
    }
  );
  it("should write on event-store for the suspension of a purpose version by the producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const suspendResponse = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByProducerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(suspendResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });

    vi.useRealTimers();
  });
  it("should write on event-store for the suspension of a purpose version by the delegated producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const suspendResponse = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
        delegationId: delegation.id,
      },
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByProducerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );

    expect(suspendResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });

    vi.useRealTimers();
  });
  it("should write on event-store for the suspension of a purpose version by the producer (self consumer)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockEService.producerId,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const suspendResponse = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
        delegationId: undefined,
      },
      getMockContext({ authData: getMockAuthData(mockEService.producerId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByProducerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(suspendResponse).toMatchObject({
      data: expectedPurpose.versions[0],

      metadata: { version: 1 },
    });

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the purpose version is suspended by the consumer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const authData = getMockAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await addOneEService(mockEService);

    const suspendResponse = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
        delegationId: delegation.id,
      },
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
      suspendedByConsumer: true,
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByConsumerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(suspendResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });

    vi.useRealTimers();
  });
  it("When there's a consumer delegation should succeed when requester is Producer and the purpose version is suspended by the producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const authData = getMockAuthData();
    const mockEService = {
      ...getMockEService(),
      producerId: authData.organizationId,
    };
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
      delegationId: generateId<DelegationId>(),
    };

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneDelegation(delegation);

    const suspendResponse = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
        delegationId: undefined,
      },
      getMockContext({ authData })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByProducer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      suspendedByProducer: true,
      updatedAt: new Date(),
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByProducerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(suspendResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the purpose version is suspended by the consumer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion1],
      delegationId: generateId<DelegationId>(),
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegate);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const suspendResponse = await purposeService.suspendPurposeVersion(
      {
        purposeId: delegatePurpose.id,
        versionId: mockPurposeVersion1.id,
        delegationId: consumerDelegation.id,
      },
      getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
      suspendedByConsumer: true,
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByConsumerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(suspendResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by the same tenant and the purpose version is suspended by the consumer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: producer.id,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      producerId: producer.id,
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion1],
      delegationId: generateId<DelegationId>(),
    };

    const consumerDelegation = getMockDelegation({
      id: delegatePurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producer);
    await addOneTenant(consumerDelegate);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const suspendResponse = await purposeService.suspendPurposeVersion(
      {
        purposeId: delegatePurpose.id,
        versionId: mockPurposeVersion1.id,
        delegationId: consumerDelegation.id,
      },
      getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
    );

    const writtenEvent = await readLastPurposeEvent(delegatePurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: delegatePurpose.id,
      version: "1",
      type: "PurposeVersionSuspendedByConsumer",
      event_version: 2,
    });

    const expectedPurpose: Purpose = {
      ...delegatePurpose,
      versions: [
        {
          ...mockPurposeVersion1,
          state: purposeVersionState.suspended,
          suspendedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
      suspendedByConsumer: true,
    };

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeVersionSuspendedByConsumerV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(writtenPayload.purpose)).toEqual(
      sortPurpose(toPurposeV2(expectedPurpose))
    );
    expect(suspendResponse).toMatchObject({
      data: expectedPurpose.versions[0],
      metadata: { version: 1 },
    });

    vi.useRealTimers();
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomPurposeId: PurposeId = generateId();
    const randomVersionId: PurposeVersionId = generateId();
    const mockPurpose = getMockPurpose();
    await addOnePurpose(mockPurpose);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: randomPurposeId,
          versionId: randomVersionId,
          delegationId: undefined,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(purposeNotFound(randomPurposeId));
  });
  it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
    const mockEService = getMockEService();
    const randomVersionId: PurposeVersionId = generateId();

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it("should throw tenantNotAllowed if the requester is not the producer nor the consumer", async () => {
    const mockEService = getMockEService();
    const randomAuthData = getMockAuthData();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: randomAuthData })
      )
    ).rejects.toThrowError(tenantNotAllowed(randomAuthData.organizationId));
  });
  it("should throw tenantIsNotTheDelegatedProducer if the requester is not the e-service active delegation delegate", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegateId = generateId<TenantId>();
    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const randomCaller = getMockAuthData();

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: delegation.id,
        },
        getMockContext({ authData: randomCaller })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegatedProducer(
        randomCaller.organizationId,
        delegation.id
      )
    );
  });
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw tenantIsNotTheDelegate if the requester is the e-service delegate but the delegation is in %s state",
    async (delegationState) => {
      const mockEService = getMockEService();
      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: randomArrayItem(isSuspendable),
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };
      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      const delegateAuthData = getMockAuthData();
      const delegation = getMockDelegation({
        delegatorId: mockEService.producerId,
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegateAuthData.organizationId,
        state: delegationState,
      });

      await addOneDelegation(delegation);

      expect(
        purposeService.suspendPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            delegationId: delegation.id,
          },
          getMockContext({ authData: delegateAuthData })
        )
      ).rejects.toThrowError(
        tenantIsNotTheDelegate(delegateAuthData.organizationId)
      );
    }
  );
  it("should throw tenantIsNotTheDelegate if the requester is the producer but the purpose e-service has an active delegation", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegateId = generateId<TenantId>();
    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(tenantIsNotTheDelegate(mockEService.producerId));
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.active &&
        state !== purposeVersionState.suspended
    )
  )(
    "should throw notValidVersionState if the purpose version is in %s state",
    async (state) => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion(state);

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);
      await addOneEService(mockEService);

      expect(
        purposeService.suspendPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            delegationId: undefined,
          },
          getMockContext({
            authData: getMockAuthData(mockPurpose.consumerId),
          })
        )
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
  it("should throw tenantIsNotTheDelegate when the requester is the Consumer and is suspending a purpose version created by the delegate", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    const delegation = getMockDelegation({
      id: mockPurpose.delegationId,
      delegatorId: mockPurpose.consumerId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(tenantIsNotTheDelegate(mockPurpose.consumerId));
  });

  it("should throw purposeDelegationNotFound when the requester is the Consumer, is suspending a purpose version created by a delegate in suspendPurposeVersion, but the delegation cannot be found", async () => {
    const authData = getMockAuthData();
    const mockEService = getMockEService();

    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      randomArrayItem(isSuspendable)
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
      consumerId: authData.organizationId,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: undefined,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      purposeDelegationNotFound(mockPurpose.id, mockPurpose.delegationId!)
    );
  });

  it("should throw tenantIsNotTheDelegate when the requester is the Delegate and is suspending a purpose version created by the Consumer", async () => {
    const authData = getMockAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      consumerId: authData.organizationId,
      delegationId: undefined,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneDelegation(delegation);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: delegation.id,
        },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      )
    ).rejects.toThrowError(tenantIsNotTheDelegate(delegation.delegateId));
  });
  it("should throw tenantIsNotTheDelegate when the requester is a delegate for the eservice and there is a delegationId in purpose but for a different delegationId (a different delegate) in suspendPurposeVersion", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: randomArrayItem(isSuspendable),
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      delegationId: generateId<DelegationId>(),
    };

    const purposeDelegation = getMockDelegation({
      id: mockPurpose.delegationId,
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      delegatorId: mockPurpose.consumerId,
      state: delegationState.active,
    });

    const anotherDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);
    await addOneDelegation(anotherDelegation);
    await addOneDelegation(purposeDelegation);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          delegationId: anotherDelegation.id,
        },
        getMockContext({
          authData: getMockAuthData(anotherDelegation.delegateId),
        })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegate(anotherDelegation.delegateId)
    );
  });
});
