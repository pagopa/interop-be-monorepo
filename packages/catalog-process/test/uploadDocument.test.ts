/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorInterfaceDeletedV2,
  toEServiceV2,
  unsafeBrandId,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptor,
  interfaceAlreadyExists,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  buildInterfaceSeed,
  getMockAuthData,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "./utils.js";

describe("upload Document", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the upload of a document", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      serverUrls: [],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await catalogService.uploadDocument(
      eservice.id,
      descriptor.id,
      buildInterfaceSeed(),
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorInterfaceAdded");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorInterfaceDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          interface: {
            ...mockDocument,
            id: unsafeBrandId(
              writtenPayload.eservice!.descriptors[0]!.interface!.id
            ),
            checksum:
              writtenPayload.eservice!.descriptors[0]!.interface!.checksum,
            uploadDate: new Date(
              writtenPayload.eservice!.descriptors[0]!.interface!.uploadDate
            ),
          },
          serverUrls: ["pagopa.it"],
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.uploadDocument(
        mockEService.id,
        mockDescriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
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
      catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
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
      catalogService.uploadDocument(
        eservice.id,
        mockDescriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
  it("should throw notValidDescriptor if the descriptor is in published state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.published)
    );
  });
  it("should throw notValidDescriptor if the descriptor is in deprecated state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.deprecated,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.deprecated)
    );
  });
  it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.archived,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.archived)
    );
  });
  it("should throw notValidDescriptor if the descriptor is in suspended state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.suspended,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      notValidDescriptor(descriptor.id, descriptorState.suspended)
    );
  });
  it("should throw interfaceAlreadyExists if the descriptor already contains an interface", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(interfaceAlreadyExists(descriptor.id));
  });
});
