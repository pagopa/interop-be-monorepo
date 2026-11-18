/* eslint-disable @typescript-eslint/no-floating-promises */
import { fileManagerDeleteError, genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionDocumentDeletedV2,
  EServiceTemplateVersionInterfaceDeletedV2,
  EServiceTemplateVersionAsyncExchangeCallbackInterfaceDeletedV2,
  eserviceTemplateVersionState,
  operationForbidden,
  toEServiceTemplateV2,
  Document,
} from "pagopa-interop-models";
import { vi, expect, describe, it, afterEach } from "vitest";

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
  postgresDB,
} from "../integrationUtils.js";

describe("delete Document", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();

  it.each(["document", "version", "template"] as const)(
    "should not delete files if the event-store rejects the %s deletion",
    async (kind) => {
      const document: Document = {
        ...getMockDocument(),
        path: "documents/backup-regression.pdf",
      };
      const version: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
        docs: [document],
      };
      const template: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [version],
      };
      await addOneEServiceTemplate(template);
      const content = Buffer.from("original document");
      await fileManager.storeBytesByKey(
        config.s3Bucket,
        document.path,
        content,
        genericLogger
      );
      await writeInEventstore(
        {
          stream_id: template.id,
          version: 1,
          event: {
            type: "EServiceTemplateAdded",
            event_version: 2,
            data: { eserviceTemplate: toEServiceTemplateV2(template) },
          },
        },
        "eservice_template",
        postgresDB
      );
      const deletion = vi.spyOn(fileManager, "delete").mockClear();
      const context = getMockContext({
        authData: getMockAuthData(template.creatorId),
      });
      const deleteResource = () => {
        if (kind === "document") {
          return eserviceTemplateService.deleteDocument(
            template.id,
            version.id,
            document.id,
            context
          );
        }
        if (kind === "version") {
          return eserviceTemplateService.deleteEServiceTemplateVersion(
            template.id,
            version.id,
            context
          );
        }
        return eserviceTemplateService.deleteEServiceTemplate(
          template.id,
          context
        );
      };

      await expect(deleteResource()).rejects.toMatchObject({
        code: "eventConflictError",
      });

      expect(deletion).not.toHaveBeenCalled();
      expect(
        await fileManager.get(config.s3Bucket, document.path, genericLogger)
      ).toEqual(new Uint8Array(content));
      expect((await readLastEserviceTemplateEvent(template.id)).version).toBe(
        "1"
      );
    }
  );

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

  it("should persist the event and log a deletion failure without failing", async () => {
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
    vi.spyOn(fileManager, "delete").mockRejectedValueOnce(deletionError);
    const logError = vi.spyOn(genericLogger, "error").mockReturnThis();

    const response = await eserviceTemplateService.deleteDocument(
      eserviceTemplate.id,
      eserviceTemplateVersion.id,
      mockDocument.id,
      getMockContext({
        authData: getMockAuthData(eserviceTemplate.creatorId),
      })
    );

    expect(response).toEqual({
      data: {
        ...eserviceTemplate,
        versions: [{ ...eserviceTemplateVersion, docs: [] }],
      },
      metadata: { version: 1 },
    });
    expect(
      await fileManager.get(config.s3Bucket, mockDocument.path, genericLogger)
    ).toEqual(new Uint8Array(content));
    expect(
      (await readLastEserviceTemplateEvent(eserviceTemplate.id)).version
    ).toBe("1");
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(`s3://${config.s3Bucket}/${mockDocument.path}`)
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(deletionError.message)
    );
  });

  it("should write on event-store for the deletion of an asyncExchangeCallbackInterface, and delete the file from the bucket", async () => {
    vi.spyOn(fileManager, "delete");

    const callbackInterface = {
      ...mockDocument,
      path: `${config.eserviceTemplateDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
      asyncExchangeCallbackInterface: callbackInterface,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      asyncExchange: true,
      versions: [eserviceTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceTemplateDocumentsPath,
        resourceId: callbackInterface.id,
        name: callbackInterface.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(callbackInterface.path);

    const deleteDocumentResponse = await eserviceTemplateService.deleteDocument(
      eserviceTemplate.id,
      eserviceTemplateVersion.id,
      callbackInterface.id,
      getMockContext({
        authData: getMockAuthData(eserviceTemplate.creatorId),
      })
    );
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe(
      "EServiceTemplateVersionAsyncExchangeCallbackInterfaceDeleted"
    );
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType:
        EServiceTemplateVersionAsyncExchangeCallbackInterfaceDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEserviceTemplate = {
      ...eserviceTemplate,
      versions: [
        {
          ...eserviceTemplateVersion,
          asyncExchangeCallbackInterface: undefined,
        },
      ],
    };

    expect(writtenPayload.eserviceTemplateVersionId).toEqual(
      eserviceTemplateVersion.id
    );
    expect(writtenPayload.documentId).toEqual(callbackInterface.id);

    expect(writtenPayload).toEqual({
      eserviceTemplateVersionId: eserviceTemplateVersion.id,
      documentId: callbackInterface.id,
      eserviceTemplate: toEServiceTemplateV2(expectedEserviceTemplate),
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      callbackInterface.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(callbackInterface.path);

    expect(deleteDocumentResponse).toEqual({
      data: expectedEserviceTemplate,
      metadata: {
        version: 1,
      },
    });
  });

  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => state !== eserviceTemplateVersionState.draft
    )
  )(
    "should throw notValidEServiceTemplateVersionState when trying to delete an asyncExchangeCallbackInterface with version in %s state",
    async (state) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state,
        asyncExchangeCallbackInterface: mockDocument,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        asyncExchange: true,
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
});
