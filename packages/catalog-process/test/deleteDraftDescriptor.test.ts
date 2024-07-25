/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDraftDescriptorDeletedV2,
  toEServiceV2,
  operationForbidden,
  DescriptorId,
  generateId,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import { config } from "../src/config/config.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptor,
} from "../src/model/domain/errors.js";
import {
  fileManager,
  addOneEService,
  catalogService,
  getMockAuthData,
  readLastEserviceEvent,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
} from "./utils.js";

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

    await catalogService.deleteDraftDescriptor(
      eservice.id,
      descriptorToDelete.id,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
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

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [publishedDescriptor],
    });

    expect(writtenPayload.eservice).toEqual(expectedEservice);
    expect(writtenPayload.descriptorId).toEqual(descriptorToDelete.id);
    expect(fileManager.delete).not.toHaveBeenCalled();
  });

  it("should write on event-store for the deletion of a draft descriptor (with interface and document to delete), and delete documents and interface files from the bucket", async () => {
    vi.spyOn(fileManager, "delete");

    const document1 = {
      ...mockDocument,
      name: `${mockDocument.name}_1`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_1`,
    };
    const document2 = {
      ...mockDocument,
      name: `${mockDocument.name}_2`,
      path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_2`,
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
      config.s3Bucket,
      config.eserviceDocumentsPath,
      interfaceDocument.id,
      interfaceDocument.name,
      Buffer.from("testtest"),
      genericLogger
    );

    await fileManager.storeBytes(
      config.s3Bucket,
      config.eserviceDocumentsPath,
      document1.id,
      document1.name,
      Buffer.from("testtest"),
      genericLogger
    );

    await fileManager.storeBytes(
      config.s3Bucket,
      config.eserviceDocumentsPath,
      document2.id,
      document2.name,
      Buffer.from("testtest"),
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

    await catalogService.deleteDraftDescriptor(
      eservice.id,
      descriptorToDelete.id,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
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

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [publishedDescriptor],
    });

    expect(writtenPayload.eservice).toEqual(expectedEservice);
    expect(writtenPayload.descriptorId).toEqual(descriptorToDelete.id);

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

  it("should fail if one of the file deletions fails", async () => {
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(descriptorState.published),
      version: "1",
    };
    const descriptorToDelete: Descriptor = {
      ...getMockDescriptor(descriptorState.draft),
      docs: [mockDocument, mockDocument],
      version: "2",
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor, descriptorToDelete],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.deleteDraftDescriptor(eservice.id, descriptorToDelete.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
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
      catalogService.deleteDraftDescriptor(mockEService.id, mockDescriptorId, {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
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
      catalogService.deleteDraftDescriptor(eservice.id, descriptorIdToDelete, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
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
      catalogService.deleteDraftDescriptor(eservice.id, descriptorToDelete.id, {
        authData: getMockAuthData(),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });

  it.each([descriptorState.published, descriptorState.suspended])(
    "should throw notValidDescriptor if the eservice is in %s state",
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
        catalogService.deleteDraftDescriptor(eservice.id, descriptor.id, {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        })
      ).rejects.toThrowError(notValidDescriptor(descriptor.id, state));
    }
  );

  it.each([descriptorState.deprecated, descriptorState.archived])(
    "should throw notValidDescriptor if the eservice is in %s state",
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
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: "",
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(notValidDescriptor(descriptorToDelete.id, state));
    }
  );
});
