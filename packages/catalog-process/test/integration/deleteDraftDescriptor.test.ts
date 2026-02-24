/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  readEventByStreamIdAndVersion,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDraftDescriptorDeletedV2,
  toEServiceV2,
  operationForbidden,
  DescriptorId,
  generateId,
  EServiceDeletedV2,
  delegationState,
  delegationKind,
  EServiceDocumentId,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import { config } from "../../src/config/config.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  postgresDB,
  addOneDelegation,
} from "../integrationUtils.js";

describe("delete draft descriptor", () => {
  const mockDocument = getMockDocument();

  it("should write on event-store for the deletion of a draft descriptor (no interface nor documents to delete)", async () => {
    vi.spyOn(fileManager, "delete");

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
    };
    const descriptorToDelete: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      version: "2",
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor, descriptorToDelete],
    };
    await addOneEService(eservice);

    const deleteDraftReturn = await catalogService.deleteDraftDescriptor(
      eservice.id,
      descriptorToDelete.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      descriptors: [publishedDescriptor],
    };

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      descriptorId: descriptorToDelete.id,
    });

    expect(deleteDraftReturn).toEqual({
      data: expectedEservice,
      metadata: {
        version: 1,
      },
    });

    expect(fileManager.delete).not.toHaveBeenCalled();
  });

  it("should write on event-store for the deletion of a draft descriptor (with interface and document to delete), and delete documents and interface files from the bucket", async () => {
    vi.spyOn(fileManager, "delete");

    const documentId1 = generateId<EServiceDocumentId>();
    const documentId2 = generateId<EServiceDocumentId>();

    const document1 = {
      ...mockDocument,
      id: documentId1,
      name: `${mockDocument.name}_1`,
      path: `${config.eserviceDocumentsPath}/${documentId1}/${mockDocument.name}_1`,
    };
    const document2 = {
      ...mockDocument,
      id: documentId2,
      name: `${mockDocument.name}_2`,
      path: `${config.eserviceDocumentsPath}/${documentId2}/${mockDocument.name}_2`,
    };
    const interfaceDocument = {
      ...mockDocument,
      name: `${mockDocument.name}_interface`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_interface`,
    };

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
    };
    const descriptorToDelete: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      docs: [document1, document2],
      interface: interfaceDocument,
      version: "2",
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor, descriptorToDelete],
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

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: document1.id,
        name: document1.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceDocumentsPath,
        resourceId: document2.id,
        name: document2.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(document1.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(document2.path);

    const deleteDraftReturn = await catalogService.deleteDraftDescriptor(
      eservice.id,
      descriptorToDelete.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorDeleted",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      descriptors: [publishedDescriptor],
    };

    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      descriptorId: descriptorToDelete.id,
    });

    expect(deleteDraftReturn).toEqual({
      data: expectedEservice,
      metadata: {
        version: 1,
      },
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      genericLogger
    );
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      document1.path,
      genericLogger
    );
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      document2.path,
      genericLogger
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(document1.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(document2.path);
  });

  it("should write on event-store for the deletion of a draft descriptor and the entire eservice", async () => {
    const draftDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [draftDescriptor],
    };
    await addOneEService(eservice);

    const deleteDraftReturn = await catalogService.deleteDraftDescriptor(
      eservice.id,
      draftDescriptor.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const descriptorDeletionEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );

    const eserviceDeletionEvent = await readLastEserviceEvent(eservice.id);

    expect(descriptorDeletionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorDeleted",
      event_version: 2,
    });
    expect(eserviceDeletionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "2",
      type: "EServiceDeleted",
      event_version: 2,
    });

    const descriptorDeletionPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorDeletedV2,
      payload: descriptorDeletionEvent.data,
    });
    const eserviceDeletionPayload = decodeProtobufPayload({
      messageType: EServiceDeletedV2,
      payload: eserviceDeletionEvent.data,
    });

    const expectedEserviceBeforeDeletion: EService = {
      ...eservice,
      descriptors: [],
    };

    expect(descriptorDeletionPayload).toEqual({
      eservice: toEServiceV2(expectedEserviceBeforeDeletion),
      descriptorId: draftDescriptor.id,
    });
    expect(eserviceDeletionPayload).toEqual({
      eserviceId: eservice.id,
      eservice: toEServiceV2(expectedEserviceBeforeDeletion),
    });

    // In case the entire e-service is deleted, the return value should be undefined
    expect(deleteDraftReturn).toEqual(undefined);
  });

  it("should write on event-store for the deletion of a draft descriptor and the entire eservice (delegate)", async () => {
    const draftDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [draftDescriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const deleteDraftReturn = await catalogService.deleteDraftDescriptor(
      eservice.id,
      draftDescriptor.id,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const descriptorDeletionEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );

    const eserviceDeletionEvent = await readLastEserviceEvent(eservice.id);

    expect(descriptorDeletionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorDeleted",
      event_version: 2,
    });
    expect(eserviceDeletionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "2",
      type: "EServiceDeleted",
      event_version: 2,
    });

    const descriptorDeletionPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorDeletedV2,
      payload: descriptorDeletionEvent.data,
    });
    const eserviceDeletionPayload = decodeProtobufPayload({
      messageType: EServiceDeletedV2,
      payload: eserviceDeletionEvent.data,
    });

    const expectedEserviceBeforeDeletion: EService = {
      ...eservice,
      descriptors: [],
    };

    expect(descriptorDeletionPayload).toEqual({
      eservice: toEServiceV2(expectedEserviceBeforeDeletion),
      descriptorId: draftDescriptor.id,
    });
    expect(eserviceDeletionPayload).toEqual({
      eserviceId: eservice.id,
      eservice: toEServiceV2(expectedEserviceBeforeDeletion),
    });

    // In case the entire e-service is deleted, the return value should be undefined
    expect(deleteDraftReturn).toEqual(undefined);
  });

  it("should fail if one of the file deletions fails", async () => {
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
    };
    const descriptorToDelete: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      docs: [getMockDocument(), getMockDocument()],
      version: "2",
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor, descriptorToDelete],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.deleteDraftDescriptor(
        eservice.id,
        descriptorToDelete.id,
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

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const mockEService = getMockEService();
    const mockDescriptorId: DescriptorId = generateId();
    expect(
      catalogService.deleteDraftDescriptor(
        mockEService.id,
        mockDescriptorId,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const descriptorIdToDelete: DescriptorId = generateId();
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptor()],
    };
    await addOneEService(eservice);
    expect(
      catalogService.deleteDraftDescriptor(
        eservice.id,
        descriptorIdToDelete,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, descriptorIdToDelete)
    );
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
    };
    const descriptorToDelete: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      version: "2",
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor, descriptorToDelete],
    };
    await addOneEService(eservice);
    expect(
      catalogService.deleteDraftDescriptor(
        eservice.id,
        descriptorToDelete.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
    };
    const descriptorToDelete: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      version: "2",
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor, descriptorToDelete],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);
    expect(
      catalogService.deleteDraftDescriptor(
        eservice.id,
        descriptorToDelete.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it.each([descriptorState.published, descriptorState.suspended])(
    "should throw notValidDescriptorState if the eservice is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        interface: mockDocument,
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      expect(
        catalogService.deleteDraftDescriptor(
          eservice.id,
          descriptor.id,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );

  it.each([descriptorState.deprecated, descriptorState.archived])(
    "should throw notValidDescriptorState if the eservice is in %s state",
    async (state) => {
      const descriptorToDelete: Descriptor = {
        ...getMockDescriptor(state),
        interface: mockDocument,
        version: "1",
      };
      const publishedDescriptor: Descriptor = {
        ...getMockDescriptor(descriptorState.published),
        version: "2",
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [publishedDescriptor, descriptorToDelete],
      };
      await addOneEService(eservice);

      expect(
        catalogService.deleteDraftDescriptor(
          eservice.id,
          descriptorToDelete.id,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(
        notValidDescriptorState(descriptorToDelete.id, state)
      );
    }
  );
});
