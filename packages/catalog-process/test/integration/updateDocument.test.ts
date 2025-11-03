/* eslint-disable @typescript-eslint/no-floating-promises */
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
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  EServiceDescriptorDocumentUpdatedV2,
  operationForbidden,
  generateId,
  Document,
  delegationState,
  delegationKind,
  EServiceTemplateId,
  unsafeBrandId,
  EServiceDescriptorInterfaceUpdatedV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  eServiceDocumentNotFound,
  documentPrettyNameDuplicate,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
} from "../integrationUtils.js";

describe("update Document", () => {
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
    "should write on event-store for the update of a document in a descriptor in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        docs: [mockDocument],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const returnedDocument = await catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      const expectedEservice = toEServiceV2({
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            docs: [
              {
                ...mockDocument,
                prettyName: "updated prettyName",
              },
            ],
          },
        ],
      });

      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorDocumentUpdated");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentUpdatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.descriptorId).toEqual(descriptor.id);
      expect(writtenPayload.documentId).toEqual(mockDocument.id);
      expect(writtenPayload.eservice).toEqual(expectedEservice);
      expect(writtenPayload.eservice).toEqual(
        toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              docs: [returnedDocument],
            },
          ],
        })
      );
    }
  );

  it("should write on event-store for the update of a interface in a descriptor in draft state", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const returnedDocument = await catalogService.updateDocument(
      eservice.id,
      descriptor.id,
      mockDocument.id,
      { prettyName: "updated prettyName" },
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          interface: {
            ...mockDocument,
            prettyName: "updated prettyName",
          },
        },
      ],
    });

    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorInterfaceUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorInterfaceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.documentId).toEqual(mockDocument.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
    expect(writtenPayload.eservice).toEqual(
      toEServiceV2({
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            interface: returnedDocument,
          },
        ],
      })
    );
  });

  it.each(
    Object.values(descriptorState).filter(
      (state) =>
        state !== descriptorState.archived &&
        state !== descriptorState.waitingForApproval
    )
  )(
    "should write on event-store for the update of a document in a descriptor in %s state (delegate)",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        docs: [mockDocument],
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

      const returnedDocument = await catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      const expectedEservice = toEServiceV2({
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            docs: [
              {
                ...mockDocument,
                prettyName: "updated prettyName",
              },
            ],
          },
        ],
      });

      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorDocumentUpdated");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentUpdatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.descriptorId).toEqual(descriptor.id);
      expect(writtenPayload.documentId).toEqual(mockDocument.id);
      expect(writtenPayload.eservice).toEqual(expectedEservice);
      expect(writtenPayload.eservice).toEqual(
        toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              docs: [returnedDocument],
            },
          ],
        })
      );
    }
  );

  it("should write on event-store for the update of a interface in a descriptor in draft state (delegate)", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      interface: mockDocument,
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

    const returnedDocument = await catalogService.updateDocument(
      eservice.id,
      descriptor.id,
      mockDocument.id,
      { prettyName: "updated prettyName" },
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          interface: {
            ...mockDocument,
            prettyName: "updated prettyName",
          },
        },
      ],
    });

    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorInterfaceUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorInterfaceUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.documentId).toEqual(mockDocument.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
    expect(writtenPayload.eservice).toEqual(
      toEServiceV2({
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            interface: returnedDocument,
          },
        ],
      })
    );
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.updateDocument(
        mockEService.id,
        mockDescriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        getMockContext({})
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [mockDocument],
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
    expect(
      catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
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
      catalogService.updateDocument(
        eservice.id,
        mockDescriptor.id,
        generateId(),
        { prettyName: "updated prettyName" },
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
    "should throw notValidDescriptorState if the descriptor is in s% state for document update",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        docs: [mockDocument],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      expect(
        catalogService.updateDocument(
          eservice.id,
          descriptor.id,
          mockDocument.id,
          { prettyName: "updated prettyName" },
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
    "should throw notValidDescriptorState if the descriptor is in s% state for interface update",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        interface: mockDocument,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      expect(
        catalogService.updateDocument(
          eservice.id,
          descriptor.id,
          mockDocument.id,
          { prettyName: "updated prettyName" },
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );

  it("should throw eServiceDocumentNotFound if the document doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDocumentNotFound(eservice.id, descriptor.id, mockDocument.id)
    );
  });
  it("should throw documentPrettyNameDuplicate if a document with the same prettyName already exists in that descriptor, case insensitive", async () => {
    const document1: Document = {
      ...getMockDocument(),
      prettyName: "TEST A",
    };
    const document2: Document = {
      ...getMockDocument(),
      prettyName: "test b",
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
      docs: [document1, document2],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        document2.id,
        { prettyName: document1.prettyName.toLowerCase() },
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      documentPrettyNameDuplicate(
        document1.prettyName.toLowerCase(),
        descriptor.id
      )
    );
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
      docs: [mockDocument],
    };
    const eService: EService = {
      ...mockEService,
      templateId,
      descriptors: [descriptor],
    };
    await addOneEService(eService);
    expect(
      catalogService.updateDocument(
        eService.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        getMockContext({ authData: getMockAuthData(eService.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eService.id, templateId));
  });
});
