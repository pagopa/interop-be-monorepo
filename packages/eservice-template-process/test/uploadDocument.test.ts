/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { genericLogger } from "pagopa-interop-commons";
import {
  unsafeBrandId,
  generateId,
  eserviceTemplateVersionState,
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionInterfaceAddedV2,
  toEServiceTemplateV2,
  operationForbidden,
  Document,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
} from "pagopa-interop-commons-test";

import {
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  interfaceAlreadyExists,
  prettyNameDuplicate,
} from "../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  buildDocumentSeed,
  buildInterfaceSeed,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "./utils.js";

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

      const returnedEServiceTemplate =
        await eserviceTemplateService.createEServiceTemplateDocument(
          eserviceTemplate.id,
          version.id,
          buildInterfaceSeed(),
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
      expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceTemplateVersionInterfaceAdded");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceTemplateVersionInterfaceAddedV2,
        payload: writtenEvent.data,
      });

      const expectedEservice = toEServiceTemplateV2({
        ...eserviceTemplate,
        versions: [
          {
            ...version,
            interface: {
              ...mockDocument,
              id: unsafeBrandId(
                writtenPayload.eserviceTemplate!.versions[0]!.interface!.id
              ),
              checksum:
                writtenPayload.eserviceTemplate!.versions[0]!.interface!
                  .checksum,
              uploadDate: new Date(
                writtenPayload.eserviceTemplate!.versions[0]!.interface!.uploadDate
              ),
            },
          },
        ],
      });

      expect(writtenPayload.eserviceTemplateVersionId).toEqual(version.id);
      expect(writtenPayload.eserviceTemplate).toEqual(expectedEservice);
      expect(writtenPayload.eserviceTemplate).toEqual(
        toEServiceTemplateV2(returnedEServiceTemplate)
      );
    }
  );

  it("should throw eServiceTemplateNotFound if the eservice template doesn't exist", async () => {
    await expect(
      eserviceTemplateService.createEServiceTemplateDocument(
        mockEServiceTemplate.id,
        mockVersion.id,
        buildInterfaceSeed(),
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
    await expect(
      eserviceTemplateService.createEServiceTemplateDocument(
        eserviceTemplate.id,
        mockVersion.id,
        buildInterfaceSeed(),
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
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(interfaceAlreadyExists(version.id));
  });

  it("should throw prettyNameDuplicate if a document with the same prettyName already exists in that version, case insensitive", async () => {
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
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      prettyNameDuplicate(document.prettyName.toLowerCase(), version.id)
    );
  });
});
