/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorDocumentDeletedV2,
  toEServiceV2,
  EServiceDescriptorInterfaceDeletedV2,
  operationForbidden,
  delegationState,
  generateId,
  delegationKind,
  EServiceTemplateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  eServiceDocumentNotFound,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
} from "../integrationUtils.js";

describe("delete Document", () => {
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
    "should write on event-store for the deletion of a document, and delete the file from the bucket, for %s descriptor",
    async (state) => {
      vi.spyOn(fileManager, "delete");

      const document = {
        ...mockDocument,
        path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
      };
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        docs: [document],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };

      await addOneEService(eservice);

      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.eserviceDocumentsPath,
          resourceId: document.id,
          name: document.name,
          content: Buffer.from("testtest"),
        },
        genericLogger
      );
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContain(document.path);

      const deleteDocumentResponse = await catalogService.deleteDocument(
        eservice.id,
        descriptor.id,
        document.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorDocumentDeleted");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentDeletedV2,
        payload: writtenEvent.data,
      });

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            docs: descriptor.docs.filter((doc) => doc.id !== document.id),
          },
        ],
      };

      expect(writtenPayload.descriptorId).toEqual(descriptor.id);
      expect(writtenPayload.documentId).toEqual(document.id);
      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));

      expect(fileManager.delete).toHaveBeenCalledWith(
        config.s3Bucket,
        document.path,
        genericLogger
      );
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).not.toContain(document.path);

      expect(deleteDocumentResponse).toEqual({
        data: expectedEService,
        metadata: {
          version: 1,
        },
      });
    }
  );

  it("should write on event-store for the deletion of a document that is the descriptor interface, and delete the file from the bucket", async () => {
    vi.spyOn(fileManager, "delete");

    const interfaceDocument = {
      ...mockDocument,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: interfaceDocument,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    await addOneEService(eservice);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: interfaceDocument.id,
        name: interfaceDocument.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);

    const deleteDocumentResponse = await catalogService.deleteDocument(
      eservice.id,
      descriptor.id,
      interfaceDocument.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorInterfaceDeleted");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorInterfaceDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          interface: undefined,
          serverUrls: [],
        },
      ],
    };

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.documentId).toEqual(interfaceDocument.id);
    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);

    expect(deleteDocumentResponse).toEqual({
      data: expectedEService,
      metadata: {
        version: 1,
      },
    });
  });

  it("should write on event-store for the deletion of a document that is the descriptor interface, and delete the file from the bucket (delegate)", async () => {
    vi.spyOn(fileManager, "delete");

    const interfaceDocument = {
      ...mockDocument,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: interfaceDocument,
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

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: interfaceDocument.id,
        name: interfaceDocument.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);

    await catalogService.deleteDocument(
      eservice.id,
      descriptor.id,
      interfaceDocument.id,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorInterfaceDeleted");
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
          interface: undefined,
          serverUrls: [],
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.documentId).toEqual(interfaceDocument.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
  });

  it("should fail if the file deletion fails", async () => {
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

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
    await expect(
      catalogService.deleteDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      fileManagerDeleteError(
        mockDocument.path,
        config.s3Bucket,
        new Error("The specified bucket does not exist")
      )
    );
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.deleteDocument(
        mockEService.id,
        mockDescriptor.id,
        mockDocument.id,
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
      catalogService.deleteDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
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
      catalogService.deleteDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
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
      catalogService.deleteDocument(
        eservice.id,
        mockDescriptor.id,
        mockDocument.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
  it.each([descriptorState.archived])(
    "should throw notValidDescriptorState when trying to delete a document with descriptor in %s state",
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
        catalogService.deleteDocument(
          eservice.id,
          descriptor.id,
          mockDocument.id,
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
    "should throw notValidDescriptorState when trying to delete an interface with descriptor in %s state",
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
        catalogService.deleteDocument(
          eservice.id,
          descriptor.id,
          mockDocument.id,
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
      catalogService.deleteDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDocumentNotFound(eservice.id, descriptor.id, mockDocument.id)
    );
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined and we are deleting a document with kind DOCUMENT", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const document = { ...mockDocument, kind: "DOCUMENT" };

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [document],
    };
    const eService: EService = {
      ...mockEService,
      templateId,
      descriptors: [descriptor],
    };
    await addOneEService(eService);

    expect(
      catalogService.deleteDocument(
        eService.id,
        descriptor.id,
        mockDocument.id,
        getMockContext({ authData: getMockAuthData(eService.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eService.id, templateId));
  });
});
