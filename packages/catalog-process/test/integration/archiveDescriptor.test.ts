/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorArchivedV2,
  EServiceDescriptorArchivingCompletedV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("archive descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();

  it("should write on event-store for the archiving of a descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.suspended,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await catalogService.archiveDescriptor(
      eservice.id,
      descriptor.id,
      "AUTOMATIC",
      getMockContextInternal({})
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

    const expectedDescriptor = {
      ...descriptor,
      state: descriptorState.archived,
      archivedAt: new Date(
        Number(writtenPayload.eservice!.descriptors[0]!.archivedAt)
      ),
    };

    const expectedEService = toEServiceV2({
      ...eservice,
      descriptors: [expectedDescriptor],
    });
    expect(writtenPayload.eservice).toEqual(expectedEService);
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
  });

  it("should write on event-store for the archiving of a descriptor in archiving state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archiving,
      archivingSchedule: {
        archivableOn: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
        startedAt: new Date(new Date().getTime() - 91 * 24 * 60 * 60 * 1000),
        scope: "Descriptor",
      },
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await catalogService.archiveDescriptor(
      eservice.id,
      descriptor.id,
      "MANUAL",
      getMockContextInternal({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorArchivingCompleted");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorArchivingCompletedV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor: Descriptor = {
      ...descriptor,
      state: descriptorState.archived,
      archivedAt: new Date(
        Number(writtenPayload.eservice!.descriptors[0]!.archivedAt)
      ),
    };

    const expectedEService = toEServiceV2({
      ...eservice,
      descriptors: [expectedDescriptor],
    });

    expect(writtenPayload.eservice).toEqual(expectedEService);
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.archiveDescriptor(
        mockEService.id,
        mockDescriptor.id,
        "AUTOMATIC",
        getMockContextInternal({})
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.archiveDescriptor(
        eservice.id,
        mockDescriptor.id,
        "AUTOMATIC",
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
