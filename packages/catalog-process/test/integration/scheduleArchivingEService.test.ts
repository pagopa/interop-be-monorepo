/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockDelegation,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockDescriptorArchiving,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  delegationKind,
  delegationState,
  EService,
  gracePeriodDays as gracePeriodDaysValues,
  toEServiceV2,
  operationForbidden,
  generateId,
  EServiceArchivingScheduledV2,
  GracePeriodDays,
  ArchivingSchedule,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eserviceArchivingWithActiveOrPendingDelegation,
  gracePeriodDaysLowerThanDescriptor,
  notValidEServiceState,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import { calculateArchivableOn } from "../../src/utilities/dateCalculator.js";
import { catalogApi } from "pagopa-interop-api-clients";

describe("schedule archiving of an EService", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  const mockArchivingReason = "Test reason";
  const mockGracePeriodDays = GracePeriodDays.parse(60);

  it.each([
    {
      state: descriptorState.published,
      expectedState: descriptorState.archiving,
    },
    {
      state: descriptorState.suspended,
      expectedState: descriptorState.archivingSuspended,
    },
  ])(
    "should write on event-store to set $expectedState state for an EService in $state state with agreements in active state",
    async ({ state, expectedState }) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state: state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const scheduleEServiceArchivingResponse =
        await catalogService.scheduleEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceArchivingScheduled");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceArchivingScheduledV2,
        payload: writtenEvent.data,
      });

      const expectedDescriptor: Descriptor = {
        ...descriptor,
        state: expectedState,
        archivingSchedule: {
          archivableOn: new Date(
            Number(
              writtenPayload.eservice!.descriptors[0]!.archivingSchedule!
                .archivableOn
            )
          ),
          startedAt: new Date(
            Number(
              writtenPayload.eservice!.descriptors[0]!.archivingSchedule!
                .startedAt
            )
          ),
          scope: "EService",
          gracePeriodDays: mockGracePeriodDays,
        },
      };

      const expectedEService: EService = {
        ...eservice,
        archivingReason: mockArchivingReason,
        descriptors: [expectedDescriptor],
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
      expect(scheduleEServiceArchivingResponse).toEqual({
        data: expectedEService,
        metadata: { version: parseInt(writtenEvent.version, 10) },
      });
    }
  );

  it.each([...gracePeriodDaysValues])(
    "should compute archivableOn from the requested gracePeriodDays (gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const seed: catalogApi.EServiceArchivingSeed = {
        gracePeriodDays: gracePeriodDaysValue,
        archivingReason: mockArchivingReason,
      };
      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state: descriptorState.published,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const { data } = await catalogService.scheduleEServiceArchiving(
        eservice.id,
        seed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

      const actualArchivingSchedule = data.descriptors[0].archivingSchedule!;
      const { archivableOn: expectedArchivableOn } = calculateArchivableOn(
        actualArchivingSchedule.startedAt,
        gracePeriodDaysValue
      );

      expect(actualArchivingSchedule.archivableOn).toEqual(
        expectedArchivableOn
      );
    }
  );

  it.each([
    descriptorState.archiving,
    descriptorState.archivingSuspended,
    descriptorState.archived,
  ])(
    "should throw notValidEServiceState if the active descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state,
        version: "1",
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };

      await addOneEService(eservice);
      expect(
        catalogService.scheduleEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrow(notValidEServiceState(eservice.id));
    }
  );

  it.each([
    {
      state: descriptorState.deprecated,
      expectedState: descriptorState.archiving,
    },
    {
      state: descriptorState.suspended,
      expectedState: descriptorState.archivingSuspended,
    },
  ])(
    "should change previous descriptor version from $state state to $expectedState when archiving is scheduled for an EService",
    async ({ state, expectedState }) => {
      const previousDescriptor: Descriptor = {
        ...getMockDescriptor(),
        version: "1",
        state,
      };
      const activeDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        version: "2",
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [previousDescriptor, activeDescriptor],
      };
      await addOneEService(eservice);
      const scheduleEServiceArchivingResponse =
        await catalogService.scheduleEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceArchivingScheduled");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceArchivingScheduledV2,
        payload: writtenEvent.data,
      });

      const expectedActiveDescriptor: Descriptor = {
        ...activeDescriptor,
        state: descriptorState.archiving,
        archivingSchedule: {
          archivableOn: new Date(
            Number(
              writtenPayload.eservice!.descriptors[1]!.archivingSchedule!
                .archivableOn
            )
          ),
          startedAt: new Date(
            Number(
              writtenPayload.eservice!.descriptors[1]!.archivingSchedule!
                .startedAt
            )
          ),
          scope: "EService",
          gracePeriodDays: mockGracePeriodDays,
        },
      };

      const expectedPreviousDescriptor: Descriptor = {
        ...previousDescriptor,
        state: expectedState,
        archivingSchedule: {
          archivableOn: new Date(
            Number(
              writtenPayload.eservice!.descriptors[0]!.archivingSchedule!
                .archivableOn
            )
          ),
          startedAt: new Date(
            Number(
              writtenPayload.eservice!.descriptors[0]!.archivingSchedule!
                .startedAt
            )
          ),
          scope: "EService",
          gracePeriodDays: mockGracePeriodDays,
        },
      };

      const expectedEService: EService = {
        ...eservice,
        archivingReason: mockArchivingReason,
        descriptors: [expectedPreviousDescriptor, expectedActiveDescriptor],
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
      expect(scheduleEServiceArchivingResponse).toEqual({
        data: expectedEService,
        metadata: { version: parseInt(writtenEvent.version, 10) },
      });
    }
  );

  it.each([
    descriptorState.archiving,
    descriptorState.archivingSuspended,
    descriptorState.archived,
  ])(
    "should not change previous descriptor version in %s state when archiving is scheduled for an EService",
    async (state) => {
      const activeDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        version: "3",
      };
      const previousDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        version: "2",
      };
      const unchangedDescriptor: Descriptor = {
        ...getMockDescriptorArchiving(),
        state,
        version: "1",
      };

      const eservice: EService = {
        ...mockEService,
        descriptors: [
          unchangedDescriptor,
          previousDescriptor,
          activeDescriptor,
        ],
      };
      await addOneEService(eservice);
      const scheduleEServiceArchivingResponse =
        await catalogService.scheduleEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceArchivingScheduled",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceArchivingScheduledV2,
        payload: writtenEvent.data,
      });

      const expectedActiveDescriptor: Descriptor = {
        ...activeDescriptor,
        state: descriptorState.archiving,
        archivingSchedule: {
          archivableOn: new Date(
            Number(
              writtenPayload.eservice!.descriptors[2]!.archivingSchedule!
                .archivableOn
            )
          ),
          startedAt: new Date(
            Number(
              writtenPayload.eservice!.descriptors[2]!.archivingSchedule!
                .startedAt
            )
          ),
          scope: "EService",
          gracePeriodDays: mockGracePeriodDays,
        },
      };

      const expectedPreviousDescriptor: Descriptor = {
        ...previousDescriptor,
        state: descriptorState.archiving,
        archivingSchedule: {
          archivableOn: new Date(
            Number(
              writtenPayload.eservice!.descriptors[1]!.archivingSchedule!
                .archivableOn
            )
          ),
          startedAt: new Date(
            Number(
              writtenPayload.eservice!.descriptors[1]!.archivingSchedule!
                .startedAt
            )
          ),
          scope: "EService",
          gracePeriodDays: mockGracePeriodDays,
        },
      };

      const expectedEService: EService = {
        ...eservice,
        archivingReason: mockArchivingReason,
        descriptors: [
          unchangedDescriptor,
          expectedPreviousDescriptor,
          expectedActiveDescriptor,
        ],
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
      expect(scheduleEServiceArchivingResponse).toEqual({
        data: expectedEService,
        metadata: { version: parseInt(writtenEvent.version, 10) },
      });
    }
  );

  it("Should not throw gracePeriodDaysLowerThanDescriptor if the grace period days is equal to the descriptor grace period days", async () => {
    const activeDescriptor: Descriptor = {
      ...mockDescriptor,
      version: "2",
      state: descriptorState.published,
    };

    const descriptorArchivingSchedule: ArchivingSchedule = {
      ...calculateArchivableOn(new Date(), mockGracePeriodDays),
      scope: "Descriptor",
    };
    const archivingDescriptor: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      state: descriptorState.archiving,
      archivingSchedule: descriptorArchivingSchedule,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [activeDescriptor, archivingDescriptor],
    };
    await addOneEService(eservice);
    await expect(
      catalogService.scheduleEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).resolves.not.toThrow();
  });

  it("Should throw gracePeriodDaysLowerThanDescriptor if the grace period days is lower than the descriptor grace period days", async () => {
    const activeDescriptor: Descriptor = {
      ...mockDescriptor,
      version: "2",
      state: descriptorState.published,
    };

    const descriptorArchivingSchedule: ArchivingSchedule = {
      ...calculateArchivableOn(new Date(), GracePeriodDays.parse(90)),
      scope: "Descriptor",
    };
    const archivingDescriptor: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      state: descriptorState.archiving,
      archivingSchedule: descriptorArchivingSchedule,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [activeDescriptor, archivingDescriptor],
    };
    const expectedEServiceArchivingSchedule = calculateArchivableOn(
      new Date(),
      mockGracePeriodDays
    );
    await addOneEService(eservice);
    await expect(
      catalogService.scheduleEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrow(
      gracePeriodDaysLowerThanDescriptor(
        eservice.id,
        archivingDescriptor.id,
        expectedEServiceArchivingSchedule.archivableOn,
        descriptorArchivingSchedule.archivableOn
      )
    );
  });

  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should delete previous descriptor version in %s state when archiving is scheduled for an EService",
    async (state) => {
      const activeDescriptor: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "1",
        state: descriptorState.published,
        publishedAt: new Date(),
        interface: getMockDocument(),
      };
      const toDeleteDescriptor: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "2",
        state: state,
        interface: getMockDocument(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [activeDescriptor, toDeleteDescriptor],
      };
      await addOneEService(eservice);
      const scheduleEServiceArchivingResponse =
        await catalogService.scheduleEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceArchivingScheduled");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceArchivingScheduledV2,
        payload: writtenEvent.data,
      });

      const expectedDescriptor: Descriptor = {
        ...activeDescriptor,
        state: descriptorState.archiving,
        archivingSchedule: {
          archivableOn: new Date(
            Number(
              writtenPayload.eservice!.descriptors[0]!.archivingSchedule!
                .archivableOn
            )
          ),
          startedAt: new Date(
            Number(
              writtenPayload.eservice!.descriptors[0]!.archivingSchedule!
                .startedAt
            )
          ),
          scope: "EService",
          gracePeriodDays: mockGracePeriodDays,
        },
      };

      const expectedEService: EService = {
        ...eservice,
        archivingReason: mockArchivingReason,
        descriptors: [expectedDescriptor],
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
      expect(scheduleEServiceArchivingResponse).toEqual({
        data: expectedEService,
        metadata: { version: parseInt(writtenEvent.version, 10) },
      });
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.scheduleEServiceArchiving(
        mockEService.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrow(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      version: "1",
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.scheduleEServiceArchiving(
        eservice.id,
        {
          archivingReason: mockArchivingReason,
          gracePeriodDays: mockGracePeriodDays,
        },
        getMockContext({})
      )
    ).rejects.toThrow(operationForbidden);
  });

  it.each([delegationState.active, delegationState.waitingForApproval])(
    "should throw eserviceArchivingWithActiveOrPendingDelegation if there is a producer delegation in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.published,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        state,
      });

      await addOneEService(eservice);
      await addOneDelegation(delegation);

      await expect(
        catalogService.scheduleEServiceArchiving(
          eservice.id,
          {
            archivingReason: mockArchivingReason,
            gracePeriodDays: mockGracePeriodDays,
          },
          getMockContext({
            authData: getMockAuthData(eservice.producerId),
          })
        )
      ).rejects.toThrow(
        eserviceArchivingWithActiveOrPendingDelegation(
          eservice.id,
          delegation.id
        )
      );
    }
  );
});
