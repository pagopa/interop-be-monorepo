/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  EServiceDescriptorArchivingScheduledV2,
  generateId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("schedule archiving of a descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  it("should write on event-store to set archiving state for a descriptor in deprecated state", async () => {
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
  });

  it("should write on event-store to set archiving suspended state for a descriptor in suspended state", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.suspended,
      suspendedAt: new Date(),
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
    expect(writtenEvent.type).toBe("EServiceDescriptorArchivingScheduled");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorArchivingScheduledV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor1: Descriptor = {
      ...descriptor1,
      state: descriptorState.archivingSuspended,
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
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.scheduleEServiceDescriptorArchiving(
        mockEService.id,
        mockDescriptor.id,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
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

  it.each([
    descriptorState.draft,
    descriptorState.waitingForApproval,
    descriptorState.archiving,
    descriptorState.archivingSuspended,
    descriptorState.published,
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
});
