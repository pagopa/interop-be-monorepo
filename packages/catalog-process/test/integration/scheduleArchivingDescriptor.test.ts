/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockDescriptorArchiving,
  getMockAgreement,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  EServiceDescriptorArchivingScheduledV2,
  generateId,
  ArchivingSchedule,
  ArchivingScope,
  agreementState,
  Tenant,
  EServiceDescriptorArchivedV2,
} from "pagopa-interop-models";
import { expect, describe, it, vi, afterEach } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import * as dateCalculator from "../../src/utilities/dateCalculator.js";

describe("schedule archiving of a descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

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
      const tenant: Tenant = {
        ...getMockTenant(),
      };
      await addOneTenant(tenant);
      const agreement = {
        ...getMockAgreement(eservice.id, tenant.id, agreementState.active),
        descriptorId: descriptor1.id,
        producerId: eservice.producerId,
      };
      await addOneAgreement(agreement);
      const scheduleDescriptorArchivingResponse =
        await catalogService.scheduleEServiceDescriptorArchiving(
          eservice.id,
          descriptor1.id,
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

  it.each([descriptorState.deprecated, descriptorState.suspended])(
    "should write on event-store to set Archived state for a descriptor in %s state with agreements in active state",
    async (state) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

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
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorArchived");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorArchivedV2,
        payload: writtenEvent.data,
      });

      const expectedDescriptor1: Descriptor = {
        ...descriptor1,
        state: descriptorState.archived,
        archivedAt: new Date(),
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
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(descriptor.id, descriptor.state)
    );
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
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );

  it.each([
    {
      startedAt: new Date("2025-12-15T09:15:00Z"),
      expectedArchivableOn: new Date("2026-01-14T09:15:00Z"),
      testCase: "turn of the year",
    },
    {
      startedAt: new Date("2028-02-10T11:00:00Z"),
      expectedArchivableOn: new Date("2028-03-11T11:00:00Z"),
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
      const tenant: Tenant = {
        ...getMockTenant(),
      };
      await addOneTenant(tenant);
      const agreement = {
        ...getMockAgreement(eservice.id, tenant.id, agreementState.active),
        descriptorId: descriptor1.id,
        producerId: eservice.producerId,
      };
      await addOneAgreement(agreement);

      vi.spyOn(dateCalculator, "calculateArchivableOn").mockImplementationOnce(
        () => dateCalculator.calculateArchivableOn(startedAt, 30)
      );

      const scheduleDescriptorArchivingResponse =
        await catalogService.scheduleEServiceDescriptorArchiving(
          eservice.id,
          descriptor1.id,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        );
      const writtenEvent = await readLastEserviceEvent(eservice.id);

      const expectedArchivingSchedule: ArchivingSchedule = {
        archivableOn: expectedArchivableOn,
        startedAt: startedAt,
        scope: ArchivingScope.Enum.Descriptor,
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
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor1.id, state));
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.scheduleEServiceDescriptorArchiving(
        mockEService.id,
        mockDescriptor.id,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it.skip("should throw operationForbidden if the requester is not the producer", async () => {
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
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

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
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
