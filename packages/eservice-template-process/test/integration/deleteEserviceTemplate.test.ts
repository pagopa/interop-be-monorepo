/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  readEventByStreamIdAndVersion,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  operationForbidden,
  toEServiceTemplateV2,
  EServiceTemplateDeletedV2,
  EServiceTemplateDraftVersionDeletedV2,
} from "pagopa-interop-models";
import { expect, describe, it, vi } from "vitest";
import {
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  postgresDB,
  fileManager,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";

describe("delete eserviceTemplate", () => {
  const mockEserviceTemplateVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  it("should write on event-store for the deletion of an eserviceTemplate (eserviceTemplate with no versions)", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await eserviceTemplateService.deleteEServiceTemplate(
      eserviceTemplate.id,
      getMockContext({ authData: getMockAuthData(eserviceTemplate.creatorId) })
    );
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateDeleted",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDeletedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eserviceTemplate?.id).toBe(eserviceTemplate.id);
  });

  it("should write on event-store for the deletion of an eserviceTemplate (eserviceTemplate with a draft version only) and delete the interface and documents of the draft version", async () => {
    vi.spyOn(fileManager, "delete");

    const mockDocument = getMockDocument();
    const mockInterface = getMockDocument();
    const document = {
      ...mockDocument,
      name: `${mockDocument.name}`,
      path: `${config.eserviceTemplateDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };
    const interfaceDocument = {
      ...mockInterface,
      name: `${mockDocument.name}_interface`,
      path: `${config.eserviceTemplateDocumentsPath}/${mockInterface.id}/${mockInterface.name}_interface`,
    };

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
    ).toContain(interfaceDocument.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(document.path);

    const version: EServiceTemplateVersion = {
      ...mockEserviceTemplateVersion,
      interface: interfaceDocument,
      state: eserviceTemplateVersionState.draft,
      docs: [document],
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await eserviceTemplateService.deleteEServiceTemplate(
      eserviceTemplate.id,
      getMockContext({ authData: getMockAuthData(eserviceTemplate.creatorId) })
    );

    const versionDeletionEvent = await readEventByStreamIdAndVersion(
      eserviceTemplate.id,
      1,
      "eservice_template",
      postgresDB
    );
    const eserviceTemplateDeletionEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );

    expect(versionDeletionEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateDraftVersionDeleted",
      event_version: 2,
    });
    expect(eserviceTemplateDeletionEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "2",
      type: "EServiceTemplateDeleted",
      event_version: 2,
    });

    const versionDeletionPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDraftVersionDeletedV2,
      payload: versionDeletionEvent.data,
    });
    const eserviceTemplateDeletionPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDeletedV2,
      payload: eserviceTemplateDeletionEvent.data,
    });

    const expectedEserviceTemplateWithoutVersions: EServiceTemplate = {
      ...eserviceTemplate,
      versions: [],
    };
    expect(eserviceTemplateDeletionPayload.eserviceTemplate?.id).toBe(
      mockEServiceTemplate.id
    );
    expect(versionDeletionPayload).toEqual({
      eserviceTemplate: toEServiceTemplateV2(
        expectedEserviceTemplateWithoutVersions
      ),
      eserviceTemplateVersionId: eserviceTemplate.versions[0].id,
    });

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      genericLogger
    );
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      document.path,
      genericLogger
    );

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(document.path);
  });

  it("should throw eserviceTemplateNotFound if the eserviceTemplate doesn't exist", () => {
    void expect(
      eserviceTemplateService.deleteEServiceTemplate(
        mockEServiceTemplate.id,
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw eserviceTemplateNotFound if the requester is not the creator and eservice has draft version", async () => {
    const draftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [draftVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.deleteEServiceTemplate(
        eserviceTemplate.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the creator and eservice has non-draft version", async () => {
    const draftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [draftVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.deleteEServiceTemplate(
        eserviceTemplate.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateNotInDraftState if the eserviceTemplate has both draft and non-draft versions", async () => {
    const version1: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 1,
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
      publishedAt: new Date(),
    };
    const version2: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version1, version2],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.deleteEServiceTemplate(
        eserviceTemplate.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateNotInDraftState(eserviceTemplate.id)
    );
  });
});
