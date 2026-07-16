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
  toEServiceV2,
  GracePeriodDays,
  operationForbidden,
  EServiceDescriptorArchivingScheduledV2,
  generateId,
  ArchivingSchedule,
  ArchivingScope,
  GracePeriodDays,
} from "pagopa-interop-models";
import { expect, describe, it, vi } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  eserviceDescriptorWithActiveOrPendingDelegation,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import * as dateCalculator from "../../src/utilities/dateCalculator.js";

describe("schedule archiving of a descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  const mockGracePeriodDays = {
    gracePeriodDays: GracePeriodDays.parse(60),
  };

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
    "should write on event-store to set $expectedState state for a descriptor in $state state with agreements in active state",
    async ({ state, expectedState }) => {
      const descriptor1: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state: state,
        version: "1",
      };
      const descriptor2: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "2",
        state: descriptorState.published,
        interface: getMockDocument(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor1, descriptor2],
      };
      await addOneEService(eservice);
      const scheduleDescriptorArchivingResponse =
        await catalogService.scheduleEServiceDescriptorArchiving(
          eservice.id,
          descriptor1.id,
          mockGracePeriodDays,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorArchivingScheduled");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorArchivingScheduledV2,
        payload: writtenEvent.data,
      });

      const expectedDescriptor1: Descriptor = {
        ...descriptor1,
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
          scope: "Descriptor",
          gracePeriodDays: mockGracePeriodDays.gracePeriodDays,
        },
      };

      const expectedEService: EService = {
        ...eservice,
        descriptors: [expectedDescriptor1, descriptor2],
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
      expect(writtenPayload.descriptorId).toEqual(descriptor1.id);
      expect(scheduleDescriptorArchivingResponse).toEqual({
        data: expectedEService,
        metadata: { version: parseInt(writtenEvent.version, 10) },
      });
    }
  );

  it("should not update a descriptor that is in a EService in Archiving state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptorArchiving(),
      interface: mockDocument,
      version: "1",
    };
    const eservice: EService = {
      ...mockEService,
      archivingReason: "Generic reason",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.scheduleEServiceDescriptorArchiving(
        eservice.id,
        descriptor.id,
        mockGracePeriodDays,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrow(notValidDescriptorState(descriptor.id, descriptor.state));
  });

  it.each([descriptorState.published, descriptorState.suspended])(
    "should throw notValidDescriptorState if the descriptor is in %s state and is the active version",
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
        catalogService.scheduleEServiceDescriptorArchiving(
          eservice.id,
          descriptor.id,
          mockGracePeriodDays,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrow(notValidDescriptorState(descriptor.id, state));
    }
  );

  it.each([
    {
      startedAt: new Date("2026-10-20T14:30:15.000Z"),
      expectedArchivableOn: new Date("2026-12-20T00:00:00.000Z"),
      testCase: "base case",
    },
    {
      startedAt: new Date("2025-12-15T09:15:00Z"),
      expectedArchivableOn: new Date("2026-02-14T00:00:00Z"),
      testCase: "turn of the year",
    },
    {
      startedAt: new Date("2028-02-10T11:00:00Z"),
      expectedArchivableOn: new Date("2028-04-11T00:00:00Z"),
      testCase: "leap year",
    },
  ])(
    "should test grace period if archivableOn is $expectedArchivableOn when requested at $startedAt for $testCase",
    async ({ startedAt, expectedArchivableOn }) => {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(descriptorState.deprecated),
        interface: mockDocument,
        version: "1",
      };
      const descriptor2: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "2",
        state: descriptorState.published,
        interface: getMockDocument(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor1, descriptor2],
      };
      await addOneEService(eservice);

      vi.spyOn(dateCalculator, "calculateArchivableOn").mockImplementationOnce(
        () =>
          dateCalculator.calculateArchivableOn(
            startedAt,
            mockGracePeriodDays.gracePeriodDays
          )
      );

      const scheduleDescriptorArchivingResponse =
        await catalogService.scheduleEServiceDescriptorArchiving(
          eservice.id,
          descriptor1.id,
          mockGracePeriodDays,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );
      const writtenEvent = await readLastEserviceEvent(eservice.id);

      const expectedArchivingSchedule: ArchivingSchedule = {
        archivableOn: expectedArchivableOn,
        startedAt: startedAt,
        scope: ArchivingScope.Enum.Descriptor,
        gracePeriodDays: mockGracePeriodDays.gracePeriodDays,
      };

      const expectedDescriptor1: Descriptor = {
        ...descriptor1,
        state: descriptorState.archiving,
        archivingSchedule: expectedArchivingSchedule,
      };

      const expectedEService: EService = {
        ...eservice,
        descriptors: [expectedDescriptor1, descriptor2],
      };

      expect(scheduleDescriptorArchivingResponse).toEqual({
        data: expectedEService,
        metadata: { version: parseInt(writtenEvent.version, 10) },
      });
    }
  );

  it.each([
    descriptorState.draft,
    descriptorState.waitingForApproval,
    descriptorState.archiving,
    descriptorState.archivingSuspended,
    descriptorState.archived,
  ])(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (state) => {
      const descriptor1: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state,
        version: "1",
      };
      const descriptor2: Descriptor = {
        ...mockDescriptor,
        id: generateId(),
        version: "2",
        state: descriptorState.published,
        interface: getMockDocument(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor1, descriptor2],
      };
      await addOneEService(eservice);
      expect(
        catalogService.scheduleEServiceDescriptorArchiving(
          eservice.id,
          descriptor1.id,
          mockGracePeriodDays,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrow(notValidDescriptorState(descriptor1.id, state));
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.scheduleEServiceDescriptorArchiving(
        mockEService.id,
        mockDescriptor.id,
        mockGracePeriodDays,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrow(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.deprecated,
      version: "1",
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      version: "2",
      state: descriptorState.published,
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor1, descriptor2],
    };
    await addOneEService(eservice);
    expect(
      catalogService.scheduleEServiceDescriptorArchiving(
        eservice.id,
        descriptor1.id,
        mockGracePeriodDays,
        getMockContext({})
      )
    ).rejects.toThrow(operationForbidden);
  });

  it.each([delegationState.active, delegationState.waitingForApproval])(
    "should throw eserviceDescriptorWithActiveOrPendingDelegation if there is a producer delegation in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.deprecated,
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
        catalogService.scheduleEServiceDescriptorArchiving(
          eservice.id,
          descriptor.id,
          mockGracePeriodDays,
          getMockContext({
            authData: getMockAuthData(eservice.producerId),
          })
        )
      ).rejects.toThrow(
        eserviceDescriptorWithActiveOrPendingDelegation(
          eservice.id,
          descriptor.id,
          delegation.id
        )
      );
    }
  );

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.scheduleEServiceDescriptorArchiving(
        eservice.id,
        mockDescriptor.id,
        mockGracePeriodDays,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrow(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
