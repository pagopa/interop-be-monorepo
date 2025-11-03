/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
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
  EServiceTemplateId,
  EServiceDescriptorDocumentAddedV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  interfaceAlreadyExists,
  documentPrettyNameDuplicate,
  templateInstanceNotAllowed,
  checksumDuplicate,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
} from "../integrationUtils.js";
import { buildInterfaceSeed, buildDocumentSeed } from "../mockUtils.js";

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

      const returnedDocument = await catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildDocumentSeed(),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorDocumentAdded");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentAddedV2,
        payload: writtenEvent.data,
      });

      const expectedDocument: Document = {
        ...mockDocument,
        id: unsafeBrandId(writtenPayload.eservice!.descriptors[0]!.docs[0]!.id),
        checksum: writtenPayload.eservice!.descriptors[0]!.docs[0]!.checksum,
        uploadDate: new Date(
          writtenPayload.eservice!.descriptors[0]!.docs[0]!.uploadDate
        ),
      };

      const expectedEservice = toEServiceV2({
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            docs: [expectedDocument],
            serverUrls: [],
          },
        ],
      });

      expect(writtenPayload.descriptorId).toEqual(descriptor.id);
      expect(writtenPayload.eservice).toEqual(expectedEservice);
      expect(returnedDocument).toEqual({
        data: expectedDocument,
        metadata: {
          version: 1,
        },
      });
    }
  );

  it("should write on event-store for the upload of a interface when descriptor state is draft", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      serverUrls: [],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const returnedDocument = await catalogService.uploadDocument(
      eservice.id,
      descriptor.id,
      buildInterfaceSeed(),
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
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

    const expectedDocument: Document = {
      ...mockDocument,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[0]!.interface!.id),
      checksum: writtenPayload.eservice!.descriptors[0]!.interface!.checksum,
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[0]!.interface!.uploadDate
      ),
    };

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          interface: expectedDocument,
          serverUrls: ["pagopa.it"],
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
    expect(returnedDocument).toEqual({
      data: expectedDocument,
      metadata: {
        version: 1,
      },
    });
  });

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

      const returnedDocument = await catalogService.uploadDocument(
        eservice.id,
        descriptor.id,
        buildDocumentSeed(),
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorDocumentAdded");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentAddedV2,
        payload: writtenEvent.data,
      });

      const expectedDocument: Document = {
        ...mockDocument,
        id: unsafeBrandId(writtenPayload.eservice!.descriptors[0]!.docs[0]!.id),
        checksum: writtenPayload.eservice!.descriptors[0]!.docs[0]!.checksum,
        uploadDate: new Date(
          writtenPayload.eservice!.descriptors[0]!.docs[0]!.uploadDate
        ),
      };

      const expectedEservice = toEServiceV2({
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            docs: [expectedDocument],
            serverUrls: [],
          },
        ],
      });

      expect(writtenPayload.descriptorId).toEqual(descriptor.id);
      expect(writtenPayload.eservice).toEqual(expectedEservice);
      expect(returnedDocument).toEqual({
        data: expectedDocument,
        metadata: {
          version: 1,
        },
      });
    }
  );

  it("should write on event-store for the upload of a interface when descriptor state is draft (delegate)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
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

    const returnedDocument = await catalogService.uploadDocument(
      eservice.id,
      descriptor.id,
      buildInterfaceSeed(),
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
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

    const expectedDocument: Document = {
      ...mockDocument,
      id: unsafeBrandId(writtenPayload.eservice!.descriptors[0]!.interface!.id),
      checksum: writtenPayload.eservice!.descriptors[0]!.interface!.checksum,
      uploadDate: new Date(
        writtenPayload.eservice!.descriptors[0]!.interface!.uploadDate
      ),
    };

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          interface: expectedDocument,
          serverUrls: ["pagopa.it"],
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
    expect(returnedDocument).toEqual({
      data: expectedDocument,
      metadata: {
        version: 1,
      },
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.uploadDocument(
        mockEService.id,
        mockDescriptor.id,
        buildInterfaceSeed(),
        getMockContext({})
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
        getMockContext({})
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
        getMockContext({})
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
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
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
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
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
          buildDocumentSeed(),
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );
  it.each(
    Object.values(descriptorState).filter(
      (state) => state !== descriptorState.draft
    )
  )(
    "should throw notValidDescriptorState if the interface is in %s state",
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
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
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
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(interfaceAlreadyExists(descriptor.id));
  });
  it("should throw documentPrettyNameDuplicate if a document with the same prettyName already exists in that descriptor, case insensitive", async () => {
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
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      documentPrettyNameDuplicate(
        document.prettyName.toLowerCase(),
        descriptor.id
      )
    );
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eService: EService = {
      ...mockEService,
      templateId,
      descriptors: [descriptor],
    };
    await addOneEService(eService);
    expect(
      catalogService.uploadDocument(
        eService.id,
        descriptor.id,
        {
          ...buildDocumentSeed(),
        },
        getMockContext({ authData: getMockAuthData(eService.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eService.id, templateId));
  });
  it("should throw checksumDuplicate if the checksum is already present in the descriptor", async () => {
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
          checksum: document.checksum,
        },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(checksumDuplicate(eservice.id, descriptor.id));
  });
});
