import { fileManagerDeleteError, genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorDocumentDeletedByTemplateUpdateV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";

import { config } from "../../src/config/config.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../../src/model/domain/errors.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("delete Document", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();

  it("should write on event-store for the internal deletion of a document, and delete the file from the bucket, for %s descriptor", async () => {
    vi.spyOn(fileManager, "delete");

    const document = {
      ...mockDocument,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
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

    await catalogService.internalDeleteTemplateInstanceDescriptorDocument(
      eservice.id,
      descriptor.id,
      document.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe(
      "EServiceDescriptorDocumentDeletedByTemplateUpdate"
    );
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentDeletedByTemplateUpdateV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          docs: [],
        },
      ],
    });

    expect(writtenPayload).toEqual({
      descriptorId: descriptor.id,
      documentId: document.id,
      eservice: expectedEservice,
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      document.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(document.path);
  });

  it("should fail if the deletion fails, and should not write any events in event store", async () => {
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
    const content = Buffer.from("original document");
    await fileManager.storeBytesByKey(
      config.s3Bucket,
      mockDocument.path,
      content,
      genericLogger
    );
    const deletionError = fileManagerDeleteError(
      mockDocument.path,
      config.s3Bucket,
      new Error("Simulated deletion failure")
    );
    const deleteFile = fileManager.delete.bind(fileManager);
    vi.spyOn(fileManager, "delete").mockImplementationOnce(async (...args) => {
      await deleteFile(...args);
      throw deletionError;
    });

    await expect(
      catalogService.internalDeleteTemplateInstanceDescriptorDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrow(deletionError);

    expect(
      await fileManager.get(config.s3Bucket, mockDocument.path, genericLogger)
    ).toEqual(new Uint8Array(content));
    expect((await readLastEserviceEvent(eservice.id)).version).toBe("0");
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    await expect(
      catalogService.internalDeleteTemplateInstanceDescriptorDocument(
        mockEService.id,
        mockDescriptor.id,
        mockDocument.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.internalDeleteTemplateInstanceDescriptorDocument(
        eservice.id,
        mockDescriptor.id,
        mockDocument.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
