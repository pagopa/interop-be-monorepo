import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorDocumentDeletedByTemplateUpdateV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../src/model/domain/errors.js";
import { config } from "../src/config/config.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
} from "./utils.js";

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

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.documentId).toEqual(document.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      document.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(document.path);
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
      catalogService.internalDeleteTemplateInstanceDescriptorDocument(
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
