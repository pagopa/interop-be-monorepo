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
  Document,
  delegationState,
  generateId,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockDelegation,
} from "pagopa-interop-commons-test/index.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  interfaceAlreadyExists,
  prettyNameDuplicate,
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
  buildDocumentSeed,
  addOneDelegation,
} from "./utils.js";

describe("upload Document", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it.each(
    Object.values(descriptorState).filter(
      (state) =>
        state !== descriptorState.archived &&
        state !== descriptorState.waitingForApproval
    )
  )(
    "should write on event-store for the upload of a document when descriptor state is %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        serverUrls: [],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const returnedEService = await catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
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
      expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
    }
  );
  it.each(
    Object.values(descriptorState).filter(
      (state) =>
        state !== descriptorState.archived &&
        state !== descriptorState.waitingForApproval
    )
  )(
    "should write on event-store for the upload of a document when descriptor state is %s (delegate)",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        serverUrls: [],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        state: delegationState.active,
      });

      await addOneEService(eservice);
      await addOneDelegation(delegation);

      const returnedEService = await catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(delegation.delegateId),
          correlationId: generateId(),
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
      expect(writtenPayload.eservice).toEqual(toEServiceV2(returnedEService));
    }
  );
  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.uploadDocument(
        mockEService.id,
        mockDescriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
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
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
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
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(mockEService);
    await addOneDelegation(delegation);

    expect(
      catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
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
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each(
    Object.values(descriptorState).filter(
      (state) =>
        state === descriptorState.archived ||
        state === descriptorState.waitingForApproval
    )
  )(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
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
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );
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
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(interfaceAlreadyExists(descriptor.id));
  });
  it("should throw prettyNameDuplicate if a document with the same prettyName already exists in that descriptor, case insensitive", async () => {
    const document: Document = {
      ...getMockDocument(),
      prettyName: "TEST",
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
      docs: [document],
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
        {
          ...buildDocumentSeed(),
          prettyName: document.prettyName.toLowerCase(),
        },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      prettyNameDuplicate(document.prettyName.toLowerCase(), descriptor.id)
    );
  });
});
