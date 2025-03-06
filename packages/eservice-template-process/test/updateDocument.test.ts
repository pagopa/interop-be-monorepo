/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  generateId,
  eserviceTemplateVersionState,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  EServiceTemplate,
  toEServiceTemplateV2,
  EServiceTemplateVersionDocumentUpdatedV2,
  operationForbidden,
  Document,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceTemplateDocumentNotFound,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
  documentPrettyNameDuplicate,
} from "../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "./utils.js";

describe("update Document", () => {
  const mockVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();
  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => state !== eserviceTemplateVersionState.deprecated
    )
  )(
    "should write on event-store for the update of a document in a descriptor in %s state",
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
      const returnedDocument = await eserviceTemplateService.updateDocument(
        eserviceTemplate.id,
        version.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      );
      const writtenEvent = await readLastEserviceTemplateEvent(
        eserviceTemplate.id
      );
      const expectedEserviceTemplate = toEServiceTemplateV2({
        ...eserviceTemplate,
        versions: [
          {
            ...version,
            docs: [
              {
                ...mockDocument,
                prettyName: "updated prettyName",
              },
            ],
          },
        ],
      });

      expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceTemplateVersionDocumentUpdated");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceTemplateVersionDocumentUpdatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.eserviceTemplateVersionId).toEqual(version.id);
      expect(writtenPayload.documentId).toEqual(mockDocument.id);
      expect(writtenPayload.eserviceTemplate).toEqual(expectedEserviceTemplate);
      expect(writtenPayload.eserviceTemplate).toEqual(
        toEServiceTemplateV2({
          ...eserviceTemplate,
          versions: [
            {
              ...version,
              docs: [returnedDocument],
            },
          ],
        })
      );
    }
  );

  it("should throw eServiceTemplateNotFound if the eservice template doesn't exist", async () => {
    expect(
      eserviceTemplateService.updateDocument(
        mockEServiceTemplate.id,
        mockVersion.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the creator", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: eserviceTemplateVersionState.draft,
      docs: [mockDocument],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateDocument(
        eserviceTemplate.id,
        version.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceTemplateVersionNotFound if the version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateDocument(
        eserviceTemplate.id,
        mockVersion.id,
        generateId(),
        { prettyName: "updated prettyName" },
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceTemplateVersionNotFound(eserviceTemplate.id, mockVersion.id)
    );
  });

  it.each(
    Object.values(eserviceTemplateVersionState).filter(
      (state) => state === eserviceTemplateVersionState.deprecated
    )
  )(
    "should throw notValidDescriptorState if the descriptor is in s% state",
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
      expect(
        eserviceTemplateService.updateDocument(
          eserviceTemplate.id,
          version.id,
          generateId(),
          { prettyName: "updated prettyName" },
          {
            authData: getMockAuthData(eserviceTemplate.creatorId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(
        notValidEServiceTemplateVersionState(version.id, state)
      );
    }
  );

  it("should throw eServiceTemplateDocumentNotFound if the document doesn't exist", async () => {
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: eserviceTemplateVersionState.draft,
      docs: [],
    };
    const eservice: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eservice);
    expect(
      eserviceTemplateService.updateDocument(
        eservice.id,
        version.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        {
          authData: getMockAuthData(eservice.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eserviceTemplateDocumentNotFound(eservice.id, version.id, mockDocument.id)
    );
  });

  it("should throw documentPrettyNameDuplicate if a document with the same prettyName already exists in that version, case insensitive", async () => {
    const document1: Document = {
      ...getMockDocument(),
      prettyName: "TEST A",
    };
    const document2: Document = {
      ...getMockDocument(),
      prettyName: "test b",
    };
    const version: EServiceTemplateVersion = {
      ...mockVersion,
      interface: mockDocument,
      state: eserviceTemplateVersionState.draft,
      docs: [document1, document2],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateDocument(
        eserviceTemplate.id,
        version.id,
        document2.id,
        { prettyName: document1.prettyName.toLowerCase() },
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      documentPrettyNameDuplicate(document1.prettyName.toLowerCase(), version.id)
    );
  });
});
