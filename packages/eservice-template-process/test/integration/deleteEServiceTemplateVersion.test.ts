/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  toEServiceTemplateV2,
  operationForbidden,
  generateId,
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplateDraftVersionDeletedV2,
  EServiceTemplateDeletedV2,
  EServiceTemplateVersionId,
} from "pagopa-interop-models";
import { expect, describe, it, vi } from "vitest";
import {
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import {
  eserviceTemplateService,
  addOneEServiceTemplate,
  readLastEserviceTemplateEvent,
  fileManager,
} from "../integrationUtils.js";

describe("deleteEServiceTemplateVersion", () => {
  it("should write on event-store for the deletion of a eservice template version (template with multiple versions)", async () => {
    vi.spyOn(fileManager, "delete");

    const mockInterface = getMockDocument();
    const interfaceDoc = {
      ...mockInterface,
      name: `${mockInterface.name}_interface`,
      path: `${config.eserviceTemplateDocumentsPath}/${mockInterface.id}/${mockInterface.name}_interface`,
    };
    const mockDoc1 = getMockDocument();
    const doc1 = {
      ...mockDoc1,
      path: `${config.eserviceTemplateDocumentsPath}/${mockDoc1.id}/${mockDoc1.name}`,
    };
    const mockDoc2 = getMockDocument();
    const doc2 = {
      ...mockDoc2,
      path: `${config.eserviceTemplateDocumentsPath}/${mockDoc2.id}/${mockDoc2.name}`,
    };

    const eserviceTemplateVersion1: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: descriptorState.published,
    };
    const eserviceTemplateVersion2: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: interfaceDoc,
      docs: [doc1, doc2],
      state: descriptorState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion1, eserviceTemplateVersion2],
    };

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceTemplateDocumentsPath,
        resourceId: interfaceDoc.id,
        name: interfaceDoc.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    for (const doc of [doc1, doc2]) {
      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.eserviceTemplateDocumentsPath,
          resourceId: doc.id,
          name: doc.name,
          content: Buffer.from("testtest"),
        },
        genericLogger
      );
    }

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDoc.path);
    for (const doc of [doc1, doc2]) {
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContain(doc.path);
    }

    await addOneEServiceTemplate(eserviceTemplate);

    await eserviceTemplateService.deleteEServiceTemplateVersion(
      eserviceTemplate.id,
      eserviceTemplateVersion2.id,
      getMockContext({
        authData: getMockAuthData(eserviceTemplate.creatorId),
      })
    );

    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceTemplateDraftVersionDeleted");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDraftVersionDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEServiceTemplate = toEServiceTemplateV2({
      ...eserviceTemplate,
      versions: [eserviceTemplateVersion1],
    });

    expect(writtenPayload.eserviceTemplateVersionId).toEqual(
      eserviceTemplateVersion2.id
    );
    expect(writtenPayload.eserviceTemplate).toEqual(expectedEServiceTemplate);

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDoc.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDoc.path);

    for (const doc of [doc1, doc2]) {
      expect(fileManager.delete).toHaveBeenCalledWith(
        config.s3Bucket,
        doc.path,
        genericLogger
      );
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).not.toContain(doc.path);
    }
  });

  it("should write on event-store for the deletion of a eservice template version (template with only one version)", async () => {
    vi.spyOn(fileManager, "delete");

    const mockInterface = getMockDocument();
    const interfaceDoc = {
      ...mockInterface,
      name: `${mockInterface.name}_interface`,
      path: `${config.eserviceTemplateDocumentsPath}/${mockInterface.id}/${mockInterface.name}_interface`,
    };
    const mockDoc1 = getMockDocument();
    const doc1 = {
      ...mockDoc1,
      path: `${config.eserviceTemplateDocumentsPath}/${mockDoc1.id}/${mockDoc1.name}`,
    };
    const mockDoc2 = getMockDocument();
    const doc2 = {
      ...mockDoc2,
      path: `${config.eserviceTemplateDocumentsPath}/${mockDoc2.id}/${mockDoc2.name}`,
    };

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: interfaceDoc,
      docs: [doc1, doc2],
      state: descriptorState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: config.eserviceTemplateDocumentsPath,
        resourceId: interfaceDoc.id,
        name: interfaceDoc.name,
        content: Buffer.from("testtest"),
      },
      genericLogger
    );

    for (const doc of [doc1, doc2]) {
      await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.eserviceTemplateDocumentsPath,
          resourceId: doc.id,
          name: doc.name,
          content: Buffer.from("testtest"),
        },
        genericLogger
      );
    }

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDoc.path);
    for (const doc of [doc1, doc2]) {
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContain(doc.path);
    }

    await addOneEServiceTemplate(eserviceTemplate);

    await eserviceTemplateService.deleteEServiceTemplateVersion(
      eserviceTemplate.id,
      eserviceTemplateVersion.id,
      getMockContext({
        authData: getMockAuthData(eserviceTemplate.creatorId),
      })
    );

    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent.stream_id).toBe(eserviceTemplate.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceTemplateDeleted");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDeletedV2,
      payload: writtenEvent.data,
    });

    const expectedEServiceTemplate = toEServiceTemplateV2({
      ...eserviceTemplate,
      versions: [eserviceTemplateVersion],
    });

    expect(writtenPayload.eserviceTemplate).toEqual(expectedEServiceTemplate);

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDoc.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDoc.path);

    for (const doc of [doc1, doc2]) {
      expect(fileManager.delete).toHaveBeenCalledWith(
        config.s3Bucket,
        doc.path,
        genericLogger
      );
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).not.toContain(doc.path);
    }
  });

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", () => {
    const mockEServiceTemplate = getMockEServiceTemplate();
    expect(
      eserviceTemplateService.deleteEServiceTemplateVersion(
        mockEServiceTemplate.id,
        getMockEServiceTemplateVersion().id,
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the if the requester is not the eservice template creator and the eservice template is in not-draft state", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: descriptorState.suspended,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.deleteEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateVersionNotFound if the if the requester is not the eservice template creator and the eservice template is in draft state", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: descriptorState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.deleteEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw eserviceTemplateVersionNotFound if the eservice template version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = getMockEServiceTemplate();
    await addOneEServiceTemplate(eserviceTemplate);

    const versionId = generateId<EServiceTemplateVersionId>();

    expect(
      eserviceTemplateService.deleteEServiceTemplateVersion(
        eserviceTemplate.id,
        versionId,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(eserviceTemplate.id, versionId)
    );
  });

  it.each([
    eserviceTemplateVersionState.published,
    descriptorState.suspended,
    eserviceTemplateVersionState.deprecated,
  ])(
    "should throw notValidEServiceTemplateVersionState if the descriptor is in %s state",
    async (state) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [eserviceTemplateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);

      expect(
        eserviceTemplateService.deleteEServiceTemplateVersion(
          eserviceTemplate.id,
          eserviceTemplateVersion.id,
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
