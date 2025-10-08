/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  operationForbidden,
  generateId,
  TenantId,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  toEServiceTemplateV2,
  EServiceTemplateNameUpdatedV2,
  EService,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceTemplateWithoutPublishedVersion,
  eserviceTemplateNotFound,
  eserviceTemplateDuplicate,
  instanceNameConflict,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";

describe("updateEServiceTemplateName", () => {
  it("should write on event-store for the update of the eService template name", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    const updatedName = "eservice template new name";
    const returnedEServiceTemplate =
      await eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        updatedName,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );
    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      name: updatedName,
    };
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateNameUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateNameUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      oldName: eserviceTemplate.name,
    });
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(returnedEServiceTemplate.data)
    );
  });

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        "eservice template new name",
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the eservice template creator", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        "eservice template new name",
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateWithoutPublishedVersion if the eservice template doesn't have any published versions", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        "eservice template new name",
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
    );
  });

  it("should throw eserviceTemplateWithoutPublishedVersion if the eservice template has only draft versions", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        "eservice template new name",
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
    );
  });

  it("should throw eserviceTemplateDuplicate is there is another eservice template with the same name by the same creator", async () => {
    const creatorId = generateId<TenantId>();

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      creatorId,
      versions: [eserviceTemplateVersion],
    };

    const duplicateName = "eservice duplicate name";

    const eserviceTemplateWithSameName: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      creatorId,
      name: duplicateName,
    };

    await addOneEServiceTemplate(eserviceTemplate);
    await addOneEServiceTemplate(eserviceTemplateWithSameName);

    const updatedName = duplicateName;
    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        updatedName,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateDuplicate(duplicateName));
  });

  it("should throw eserviceTemplateDuplicate is there is another eservice template with the same name by a different creator", async () => {
    const creatorId = generateId<TenantId>();

    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      creatorId,
      versions: [eserviceTemplateVersion],
    };

    const duplicateName = "eservice duplicate name";

    const eserviceTemplateWithSameName: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      creatorId: generateId<TenantId>(),
      name: duplicateName,
    };

    await addOneEServiceTemplate(eserviceTemplate);
    await addOneEServiceTemplate(eserviceTemplateWithSameName);

    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        duplicateName,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateDuplicate(duplicateName));
  });

  it("should throw instanceNameConflict if the name is already used by a producer of a template instance", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateVersion],
    };

    const updatedName = "eservice template new name";
    const producerId = generateId<TenantId>();

    const templateInstance: EService = {
      ...getMockEService(),
      producerId,
      name: eserviceTemplate.name,
      templateId: eserviceTemplate.id,
    };

    const tenantEService: EService = {
      ...getMockEService(),
      producerId,
      name: updatedName,
    };

    await addOneEServiceTemplate(eserviceTemplate);
    await addOneEService(tenantEService);
    await addOneEService(templateInstance);

    expect(
      eserviceTemplateService.updateEServiceTemplateName(
        eserviceTemplate.id,
        updatedName,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(instanceNameConflict(eserviceTemplate.id));
  });
});
