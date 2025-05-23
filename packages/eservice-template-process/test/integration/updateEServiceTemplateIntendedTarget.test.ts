/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  operationForbidden,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  toEServiceTemplateV2,
  EServiceTemplateIntendedTargetUpdatedV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceTemplateWithoutPublishedVersion,
  eserviceTemplateNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";

describe("updateEServiceTemplateIntendedTarget", () => {
  it("should write on event-store for the update of the eService template description", async () => {
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
    const updatedTemplateDescription = "eservice template new description";
    const returnedEServiceTemplate =
      await eserviceTemplateService.updateEServiceTemplateIntendedTarget(
        eserviceTemplate.id,
        updatedTemplateDescription,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );
    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      intendedTarget: updatedTemplateDescription,
    };
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateIntendedTargetUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateIntendedTargetUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(updatedEServiceTemplate)
    );
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(returnedEServiceTemplate)
    );
  });

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    expect(
      eserviceTemplateService.updateEServiceTemplateIntendedTarget(
        eserviceTemplate.id,
        "eservice template new description",
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
      eserviceTemplateService.updateEServiceTemplateIntendedTarget(
        eserviceTemplate.id,
        "eservice template new description",
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eserviceTemplateWithoutPublishedVersion if the eservice template doesn't have any published versions", async () => {
    const eserviceTemplate = getMockEServiceTemplate();
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.updateEServiceTemplateIntendedTarget(
        eserviceTemplate.id,
        "eservice template new description",
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
      eserviceTemplateService.updateEServiceTemplateIntendedTarget(
        eserviceTemplate.id,
        "eservice template new description",
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
    );
  });
});
