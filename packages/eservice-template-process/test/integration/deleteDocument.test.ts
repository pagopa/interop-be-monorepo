/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger, fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionDocumentDeletedV2,
  EServiceTemplateVersionInterfaceDeletedV2,
  eserviceTemplateVersionState,
  operationForbidden,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import { config } from "../../src/config/config.js";
import {
  eserviceTemplateDocumentNotFound,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  fileManager,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";

describe("delete Document", () => {
  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();

  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => state !== eserviceTemplateVersionState.deprecated
    )
  )(
    "should write on event-store for the deletion of a document, and delete the file from the bucket, for %s version",
    async (state) => {
      vi.spyOn(fileManager, "delete");

      const document = {
        ...mockDocument,
        path: `${config.eserviceTemplateDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
      };
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state,
        docs: [document],
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [eserviceTemplateVersion],
      };

      await addOneEServiceTemplate(eserviceTemplate);

      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.eserviceTemplateDocumentsPath,
          resourceId: document.id,
          name: document.name,
          content: Buffer.from("testtest"),
        },
        genericLogger
      );
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContain(document.path);

      const deleteDocumentResponse =
        await eserviceTemplateService.deleteDocument(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
          document.id,
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        );
      const writtenEvent = await readLastEserviceTemplateEvent(
        eserviceTemplate.id
      );
      expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceTemplateVersionDocumentDeleted");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceTemplateVersionDocumentDeletedV2,
        payload: writtenEvent.data,
      });

      const expectedEserviceTemplate = {
        ...eserviceTemplate,
        versions: [
          {
            ...eserviceTemplateVersion,
            docs: [],
          },
        ],
      };

      expect(writtenPayload.eserviceTemplateVersionId).toEqual(
        eserviceTemplateVersion.id
      );
      expect(writtenPayload.documentId).toEqual(document.id);

      expect(writtenPayload).toEqual({
        eserviceTemplateVersionId: eserviceTemplateVersion.id,
        documentId: document.id,
        eserviceTemplate: toEServiceTemplateV2(expectedEserviceTemplate),
      });

      expect(fileManager.delete).toHaveBeenCalledWith(
        config.s3Bucket,
        document.path,
        genericLogger
      );
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).not.toContain(document.path);

      expect(deleteDocumentResponse).toEqual({
        data: expectedEserviceTemplate,
        metadata: {
          version: 1,
        },
      });
    }
  );

  it("should write on event-store for the deletion of a document that is the version interface, and delete the file from the bucket", async () => {
    vi.spyOn(fileManager, "delete");

    const interfaceDocument = {
      ...mockDocument,
      path: `${config.eserviceTemplateDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
      interface: interfaceDocument,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceTemplateDocumentsPath,
        resourceId: interfaceDocument.id,
        name: interfaceDocument.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);

    const deleteDocumentResponse = await eserviceTemplateService.deleteDocument(
      eserviceTemplate.id,
      eserviceTemplateVersion.id,
      interfaceDocument.id,
      getMockContext({
        authData: getMockAuthData(eserviceTemplate.creatorId),
      })
    );
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceTemplateVersionInterfaceDeleted");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionInterfaceDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEserviceTemplate = {
      ...eserviceTemplate,
      versions: [
        {
          ...eserviceTemplateVersion,
          interface: undefined,
        },
      ],
    };

    expect(writtenPayload.eserviceTemplateVersionId).toEqual(
      eserviceTemplateVersion.id
    );
    expect(writtenPayload.documentId).toEqual(interfaceDocument.id);
    expect(writtenPayload).toEqual({
      eserviceTemplateVersionId: eserviceTemplateVersion.id,
      documentId: interfaceDocument.id,
      eserviceTemplate: toEServiceTemplateV2(expectedEserviceTemplate),
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);

    expect(deleteDocumentResponse).toEqual({
      data: expectedEserviceTemplate,
      metadata: {
        version: 1,
      },
    });
  });

  it("should throw eserviceTemplateNotFound if the eservice doesn't exist", async () => {
    expect(
      eserviceTemplateService.deleteDocument(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        mockDocument.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the creator", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
      docs: [mockDocument],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.deleteDocument(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        mockDocument.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateVersionNotFound if the version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.deleteDocument(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id,
        mockDocument.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id
      )
    );
  });

  it.each([eserviceTemplateVersionState.deprecated])(
    "should throw notValidEServiceTemplateVersionState when trying to delete a document with version in %s state",
    async (state) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state,
        docs: [mockDocument],
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [eserviceTemplateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      expect(
        eserviceTemplateService.deleteDocument(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
          mockDocument.id,
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(eserviceTemplateVersion.id, state)
      );
    }
  );

  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => state !== eserviceTemplateVersionState.draft
    )
  )(
    "should throw notValidEServiceTemplateVersionState when trying to delete an interface with version in %s state",
    async (state) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state,
        interface: mockDocument,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [eserviceTemplateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      expect(
        eserviceTemplateService.deleteDocument(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
          mockDocument.id,
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(eserviceTemplateVersion.id, state)
      );
    }
  );

  it("should throw eServiceTemplateDocumentNotFound if the document doesn't exist", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
      docs: [],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.deleteDocument(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        mockDocument.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateDocumentNotFound(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        mockDocument.id
      )
    );
  });

  it("should fail if the file deletion fails", async () => {
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
      docs: [mockDocument],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);
    await expect(
      eserviceTemplateService.deleteDocument(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        mockDocument.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      fileManagerDeleteError(
        mockDocument.path,
        config.s3Bucket,
        new Error("The specified bucket does not exist")
      )
    );
  });
});
