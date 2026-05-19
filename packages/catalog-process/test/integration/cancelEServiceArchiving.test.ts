/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
  EServiceArchivingCanceledV2,
  generateId,
  archivingScope,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eserviceNotInArchiving,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("cancel eservice archiving", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();

  const archivingScheduleEService = {
    archivableOn: new Date(),
    startedAt: new Date(),
    scope: archivingScope.eservice,
  };

  it("should write on event-store restoring published state for vLatest in archiving and deprecated for older descriptors", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archiving,
      version: "1",
      archivingSchedule: archivingScheduleEService,
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: getMockDocument(),
      state: descriptorState.archiving,
      version: "2",
      archivingSchedule: archivingScheduleEService,
    };
    const eservice: EService = {
      ...mockEService,
      archivingReason: "some reason",
      descriptors: [descriptor1, descriptor2],
    };
    await addOneEService(eservice);

    const result = await catalogService.cancelEServiceArchiving(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceArchivingCanceled");
    expect(writtenEvent.event_version).toBe(2);

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceArchivingCanceledV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor1: Descriptor = {
      ...descriptor1,
      state: descriptorState.deprecated,
      archivingSchedule: undefined,
    };
    const expectedDescriptor2: Descriptor = {
      ...descriptor2,
      state: descriptorState.published,
      archivingSchedule: undefined,
    };
    const expectedEService: EService = {
      ...eservice,
      descriptors: [expectedDescriptor1, expectedDescriptor2],
      archivingReason: undefined,
    };

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(result).toEqual({
      data: expectedEService,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
  });

  it("should write on event-store restoring suspended state for archivingSuspended descriptors", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archivingSuspended,
      suspendedAt: new Date(),
      version: "1",
      archivingSchedule: archivingScheduleEService,
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: getMockDocument(),
      state: descriptorState.archivingSuspended,
      suspendedAt: new Date(),
      version: "2",
      archivingSchedule: archivingScheduleEService,
    };
    const eservice: EService = {
      ...mockEService,
      archivingReason: "some reason",
      descriptors: [descriptor1, descriptor2],
    };
    await addOneEService(eservice);

    const result = await catalogService.cancelEServiceArchiving(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.type).toBe("EServiceArchivingCanceled");

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceArchivingCanceledV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor1: Descriptor = {
      ...descriptor1,
      state: descriptorState.suspended,
      archivingSchedule: undefined,
    };
    const expectedDescriptor2: Descriptor = {
      ...descriptor2,
      state: descriptorState.suspended,
      archivingSchedule: undefined,
    };
    const expectedEService: EService = {
      ...eservice,
      descriptors: [expectedDescriptor1, expectedDescriptor2],
      archivingReason: undefined,
    };

    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
    expect(result).toEqual({
      data: expectedEService,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
  });

  it("should not modify descriptors with scope == Descriptor", async () => {
    const descriptorWithDescriptorScope: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archiving,
      version: "1",
      archivingSchedule: {
        archivableOn: new Date(),
        startedAt: new Date(),
        scope: archivingScope.descriptor,
      },
    };
    const descriptorWithEServiceScope: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      interface: getMockDocument(),
      state: descriptorState.archiving,
      version: "2",
      archivingSchedule: archivingScheduleEService,
    };
    const eservice: EService = {
      ...mockEService,
      archivingReason: "some reason",
      descriptors: [descriptorWithDescriptorScope, descriptorWithEServiceScope],
    };
    await addOneEService(eservice);

    const result = await catalogService.cancelEServiceArchiving(
      eservice.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        descriptorWithDescriptorScope,
        {
          ...descriptorWithEServiceScope,
          state: descriptorState.published,
          archivingSchedule: undefined,
        },
      ],
      archivingReason: undefined,
    };

    expect(result.data).toEqual(expectedEService);
  });

  it("should throw eServiceNotFound if the eservice does not exist", async () => {
    await expect(
      catalogService.cancelEServiceArchiving(
        mockEService.id,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archiving,
      version: "1",
      archivingSchedule: archivingScheduleEService,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.cancelEServiceArchiving(eservice.id, getMockContext({}))
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceNotInArchiving if no descriptor has EService scope", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archiving,
      version: "1",
      archivingSchedule: {
        archivableOn: new Date(),
        startedAt: new Date(),
        scope: archivingScope.descriptor,
      },
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.cancelEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInArchiving(eservice.id));
  });

  it("should throw eserviceNotInArchiving if the latest descriptor has no archivingSchedule", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
      version: "1",
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.cancelEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInArchiving(eservice.id));
  });
});
