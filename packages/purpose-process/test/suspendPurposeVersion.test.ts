/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  decodeProtobufPayload,
  getMockDelegation,
  getRandomAuthData,
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
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  organizationNotAllowed,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import {
  addOnePurpose,
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

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(mockPurpose.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(mockEService.producerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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

    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(delegation.delegateId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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

    const returnedPurposeVersion = await purposeService.suspendPurposeVersion(
      {
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
      },
      {
        authData: getRandomAuthData(mockEService.producerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      }
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
      purposeService.suspendPurposeVersion(
        {
          purposeId: randomPurposeId,
          versionId: randomVersionId,
        },
        {
          authData: getRandomAuthData(),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
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
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
        },
        {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      purposeVersionNotFound(mockPurpose.id, randomVersionId)
    );
  });
  it("should throw organizationNotAllowed if the requester is not the producer nor the consumer", async () => {
    const mockEService = getMockEService();
    const randomAuthData = getRandomAuthData();
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
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: randomAuthData,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      organizationNotAllowed(randomAuthData.organizationId)
    );
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

    const delegateId = generateId<TenantId>();
    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    const randomCaller = getRandomAuthData();

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: randomCaller,
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
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

      const delegateAuthData = getRandomAuthData();
      const delegation = getMockDelegation({
        delegatorId: mockEService.producerId,
        kind: delegationKind.delegatedProducer,
        eserviceId: mockEService.id,
        delegateId: delegateAuthData.organizationId,
        state: delegationState,
      });

      await writeInReadmodel(delegation, delegations);

      expect(
        purposeService.suspendPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
          },
          {
            authData: delegateAuthData,
            correlationId: generateId(),
            logger: genericLogger,
            serviceName: "",
          }
        )
      ).rejects.toThrowError(
        organizationNotAllowed(delegateAuthData.organizationId)
      );
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

    const delegateId = generateId<TenantId>();
    const delegation = getMockDelegation({
      delegatorId: mockEService.producerId,
      kind: delegationKind.delegatedProducer,
      eserviceId: mockEService.id,
      delegateId,
      state: delegationState.active,
    });

    await writeInReadmodel(delegation, delegations);

    expect(
      purposeService.suspendPurposeVersion(
        {
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
        },
        {
          authData: getRandomAuthData(mockEService.producerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        }
      )
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
        purposeService.suspendPurposeVersion(
          {
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
          },
          {
            authData: getRandomAuthData(mockPurpose.consumerId),
            correlationId: generateId(),
            logger: genericLogger,
            serviceName: "",
          }
        )
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    }
  );
});
