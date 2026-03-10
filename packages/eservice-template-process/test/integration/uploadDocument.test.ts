/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  unsafeBrandId,
  eserviceTemplateVersionState,
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionInterfaceAddedV2,
  toEServiceTemplateV2,
  operationForbidden,
  Document,
  EServiceTemplateVersionDocumentAddedV2,
  EServiceTemplateVersionState,
  generateId,
  EServiceTemplateVersionId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  checksumDuplicate,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  interfaceAlreadyExists,
  documentPrettyNameDuplicate,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";
import { buildDocumentSeed, buildInterfaceSeed } from "../mockUtils.js";

describe("upload Document", () => {
  const mockVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();
  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) =>
        state !== eserviceTemplateVersionState.deprecated &&
        state !== eserviceTemplateVersionState.published
    )
  )(
    "should write on event-store for the upload of a document when version state is %s",
    async (state) => {
      const version: EServiceTemplateVersion = {
        ...mockVersion,
        state,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [version],
      };
      await addOneEServiceTemplate(eserviceTemplate);

      const returnedDocument =
        await eserviceTemplateService.createEServiceTemplateDocument(
          eserviceTemplate.id,
          version.id,
          buildDocumentSeed(),
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        );

      const writtenEvent = await readLastEserviceTemplateEvent(
        eserviceTemplate.id
      );

      expect(writtenEvent).toMatchObject({
        stream_id: eserviceTemplate.id,
        version: "1",
        type: "EServiceTemplateVersionDocumentAdded",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceTemplateVersionDocumentAddedV2,
        payload: writtenEvent.data,
      });

      const expectedDocument: Document = {
        ...mockDocument,
        id: unsafeBrandId(
          writtenPayload.eserviceTemplate!.versions[0]!.docs[0]!.id
        ),
        checksum:
          writtenPayload.eserviceTemplate!.versions[0]!.docs[0]!.checksum,
        uploadDate: new Date(
          writtenPayload.eserviceTemplate!.versions[0]!.docs[0]!.uploadDate
        ),
      };

      const expectedEserviceTemplate = toEServiceTemplateV2({
        ...eserviceTemplate,
        versions: [
          {
            ...version,
            docs: [expectedDocument],
          },
        ],
      });

      expect(writtenPayload.eserviceTemplateVersionId).toEqual(version.id);
      expect(writtenPayload).toEqual({
        eserviceTemplateVersionId: version.id,
        documentId: expectedDocument.id,
        eserviceTemplate: expectedEserviceTemplate,
      });
      expect(returnedDocument).toEqual({
        data: expectedDocument,
        metadata: {
          version: 1,
        },
      });
    }
  );

  it("should write on event-store for the upload of a interface when version state is draft", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const returnedDocument =
      await eserviceTemplateService.createEServiceTemplateDocument(
        eserviceTemplate.id,
        version.id,
        buildInterfaceSeed(),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateVersionInterfaceAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionInterfaceAddedV2,
      payload: writtenEvent.data,
    });

    const expectedDocument: Document = {
      ...mockDocument,
      id: unsafeBrandId(
        writtenPayload.eserviceTemplate!.versions[0]!.interface!.id
      ),
      checksum:
        writtenPayload.eserviceTemplate!.versions[0]!.interface!.checksum,
      uploadDate: new Date(
        writtenPayload.eserviceTemplate!.versions[0]!.interface!.uploadDate
      ),
    };

    const expectedEserviceTemplate = toEServiceTemplateV2({
      ...eserviceTemplate,
      versions: [
        {
          ...version,
          interface: expectedDocument,
        },
      ],
    });

    expect(writtenPayload.eserviceTemplateVersionId).toEqual(version.id);
    expect(writtenPayload).toEqual({
      eserviceTemplateVersionId: version.id,
      documentId: expectedDocument.id,
      eserviceTemplate: expectedEserviceTemplate,
    });
    expect(returnedDocument).toEqual({
      data: expectedDocument,
      metadata: {
        version: 1,
      },
    });
  });

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", async () => {
    await expect(
      eserviceTemplateService.createEServiceTemplateDocument(
        mockEServiceTemplate.id,
        mockVersion.id,
        buildInterfaceSeed(),
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the creator", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    await expect(
      eserviceTemplateService.createEServiceTemplateDocument(
        eserviceTemplate.id,
        version.id,
        buildInterfaceSeed(),
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
    await expect(
      eserviceTemplateService.createEServiceTemplateDocument(
        eserviceTemplate.id,
        mockVersion.id,
        buildInterfaceSeed(),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(eserviceTemplate.id, mockVersion.id)
    );
  });

  const statesToExclude: EServiceTemplateVersionState[] = [
    eserviceTemplateVersionState.draft,
    eserviceTemplateVersionState.published,
    eserviceTemplateVersionState.suspended,
  ];

  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => !statesToExclude.includes(state)
    )
  )(
    "should throw notValidEServiceTemplateVersionState if the document is in s% state",
    async (state) => {
      const version: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(
          generateId<EServiceTemplateVersionId>(),
          state
        ),
        docs: [mockDocument],
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [version],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      await expect(
        eserviceTemplateService.createEServiceTemplateDocument(
          eserviceTemplate.id,
          version.id,
          buildDocumentSeed(),
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(version.id, state)
      );
    }
  );

  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => state !== eserviceTemplateVersionState.draft
    )
  )(
    "should throw notValidEServiceTemplateVersionState if the interface is in s% state",
    async (state) => {
      const version: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(
          generateId<EServiceTemplateVersionId>(),
          state
        ),
        interface: mockDocument,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [version],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      await expect(
        eserviceTemplateService.createEServiceTemplateDocument(
          eserviceTemplate.id,
          version.id,
          buildInterfaceSeed(),
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(version.id, state)
      );
    }
  );

  it("should throw interfaceAlreadyExists if the version already contains an interface", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      interface: mockDocument,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await expect(
      eserviceTemplateService.createEServiceTemplateDocument(
        eserviceTemplate.id,
        version.id,
        buildInterfaceSeed(),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(interfaceAlreadyExists(version.id));
  });

  it("should throw documentPrettyNameDuplicate if a document with the same prettyName already exists in that version, case insensitive", async () => {
    const document: Document = {
      ...getMockDocument(),
      prettyName: "TEST",
    };
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      interface: mockDocument,
      state: eserviceTemplateVersionState.draft,
      docs: [document],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await expect(
      eserviceTemplateService.createEServiceTemplateDocument(
        eserviceTemplate.id,
        version.id,
        {
          ...buildDocumentSeed(),
          prettyName: document.prettyName.toLowerCase(),
        },
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      documentPrettyNameDuplicate(document.prettyName.toLowerCase(), version.id)
    );
  });

  it("should throw checksumDuplicate if the checksum is already present in the version", async () => {
    const document = {
      ...getMockDocument(),
      prettyName: "First doc",
      checksum: "checksum",
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [
        {
          ...mockVersion,
          docs: [document],
        },
      ],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await expect(
      eserviceTemplateService.createEServiceTemplateDocument(
        eserviceTemplate.id,
        mockVersion.id,
        buildDocumentSeed(),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      checksumDuplicate(eserviceTemplate.id, mockVersion.id)
    );
  });
});
