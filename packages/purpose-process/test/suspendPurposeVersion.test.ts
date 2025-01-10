/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  decodeProtobufPayload,
  getMockAuthData,
  getMockDelegation,
  getRandomAuthData,
  addSomeRandomDelegations,
  getMockAgreement,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  toReadModelEService,
  generateId,
  PurposeVersionSuspendedByConsumerV2,
  toPurposeV2,
  PurposeVersionSuspendedByProducerV2,
  PurposeId,
  PurposeVersionId,
  TenantId,
  toPurposeVersionV2,
  delegationState,
  delegationKind,
  Agreement,
  EService,
  eserviceMode,
  tenantKind,
  agreementState,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  organizationNotAllowed,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  delegations,
  eservices,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";

describe("suspendPurposeVersion", () => {
  it("should write on event-store for the suspension of a purpose version by the consumer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion1.id,
      organizationId: mockPurpose.consumerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should write on event-store for the suspension of a purpose version by the producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion1.id,
      organizationId: mockEService.producerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should write on event-store for the suspension of a purpose version by the delegated producer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion1.id,
      organizationId: delegate.organizationId,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should write on event-store for the suspension of a purpose version by the producer (self consumer)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      consumerId: mockEService.producerId,
      versions: [mockPurposeVersion1],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion1.id,
      organizationId: mockEService.producerId,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the purpose version is suspended by the consumer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion1],
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion({
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion1.id,
      organizationId: authData.organizationId,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the purpose version is suspended by the consumer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const producerDelegator = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumerDelegator = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };
    const consumer = {
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
      state: purposeVersionState.active,
    };

    const delegatePurpose: Purpose = {
      ...getMockPurpose(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      versions: [mockPurposeVersion1],
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producerDelegator.id,
      delegateId: producer.id,
      state: delegationState.active,
    });

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumerDelegator.id,
      delegateId: consumer.id,
      state: delegationState.active,
    });

    await addOneTenant(producerDelegator);
    await addOneTenant(producer);
    await addOneTenant(consumerDelegator);
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(delegatePurpose);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(delegatePurpose, addOneDelegation);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion({
      purposeId: delegatePurpose.id,
      versionId: mockPurposeVersion1.id,
      organizationId: consumer.id,
      correlationId: generateId(),
      logger: genericLogger,
    });

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

    expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    expect(
      writtenPayload.purpose?.versions.find(
        (v) => v.id === returnedPurposeVersion.id
      )
    ).toEqual(toPurposeVersionV2(returnedPurposeVersion));

    vi.useRealTimers();
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomPurposeId: PurposeId = generateId();
    const randomVersionId: PurposeVersionId = generateId();
    const mockPurpose = getMockPurpose();
    await addOnePurpose(mockPurpose);

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: randomPurposeId,
        versionId: randomVersionId,
        organizationId: generateId(),
        correlationId: generateId(),
        logger: genericLogger,
      })
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
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: randomVersionId,
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it("should throw organizationNotAllowed if the requester is not the producer nor the consumer", async () => {
    const mockEService = getMockEService();
    const randomId: TenantId = generateId();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: randomId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(organizationNotAllowed(randomId));
  });
  it("should throw organizationNotAllowed if the requester is not the e-service active delegation delegate", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    const randomCaller = getMockAuthData();

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: randomCaller.organizationId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(organizationNotAllowed(randomCaller.organizationId));
  });
  it.each(
    Object.values(delegationState).filter((s) => s !== delegationState.active)
  )(
    "should throw organizationNotAllowed if the requester is the e-service delegate but the delegation is in %s state",
    async (delegationState) => {
      const mockEService = getMockEService();
      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };
      await addOnePurpose(mockPurpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      const delegate = getMockAuthData();
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegate.organizationId,
        state: delegationState,
      });

      await writeInReadmodel(delegation, delegations);

      expect(
        purposeService.suspendPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: delegate.organizationId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(organizationNotAllowed(delegate.organizationId));
    }
  );
  it("should throw organizationNotAllowed if the requester is the producer but the purpose e-service has an active delegation", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId: delegate.organizationId,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockEService.producerId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(organizationNotAllowed(mockEService.producerId));
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
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.suspendPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
  it("should throw organizationNotAllowed when the requester is the Consumer but there is a Consumer Delegation", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };
    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockEService.id,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    expect(
      purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: authData.organizationId,
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
  });
});
