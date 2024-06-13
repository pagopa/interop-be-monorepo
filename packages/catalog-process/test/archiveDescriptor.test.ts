/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorActivatedV2,
  toEServiceV2,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  readLastEserviceEvent,
} from "./utils.js";

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
    await catalogService.archiveDescriptor(eservice.id, descriptor.id, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: "",
      serviceName: "",
      logger: genericLogger,
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorArchived");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorActivatedV2,
      payload: writtenEvent.data,
    });

    const updatedDescriptor = {
      ...descriptor,
      state: descriptorState.archived,
      archivedAt: new Date(
        Number(writtenPayload.eservice!.descriptors[0]!.archivedAt)
      ),
    };

    const expectedEService = toEServiceV2({
      ...eservice,
      descriptors: [updatedDescriptor],
    });
    expect(writtenPayload.eservice).toEqual(expectedEService);
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.archiveDescriptor(mockEService.id, mockDescriptor.id, {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    expect(
      catalogService.archiveDescriptor(eservice.id, mockDescriptor.id, {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.archiveDescriptor(eservice.id, descriptor.id, {
        authData: getMockAuthData(),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });
});
