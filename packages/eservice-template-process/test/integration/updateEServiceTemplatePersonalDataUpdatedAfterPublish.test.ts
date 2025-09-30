/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  toEServiceTemplateV2,
  EServiceTemplatePersonalDataFlagUpdatedAfterPublicationV2,
  operationForbidden,
  eserviceTemplateVersionState,
  EServiceTemplateVersion,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";
import {
  eserviceTemplateNotFound,
  eserviceTemplatePersonalDataFlagCanOnlyBeSetOnce,
  eserviceTemplateWithoutPublishedVersion,
} from "../../src/model/domain/errors.js";

describe("update EService Template personalData flag for an already created EService Template", async () => {
  it("should write on event-store for the update of the EService Template personalData flag (undefined -> true)", async () => {
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
    const newPersonalDataValue = true;

    const returnedEServiceTemplate =
      await eserviceTemplateService.updateEServiceTemplatePersonalDataFlagAfterPublication(
        eserviceTemplate.id,
        newPersonalDataValue,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      personalData: newPersonalDataValue,
    };

    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplatePersonalDataFlagUpdatedAfterPublication",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplatePersonalDataFlagUpdatedAfterPublicationV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(updatedEServiceTemplate)
    );
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(returnedEServiceTemplate)
    );
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    "should NOT write on event-store for the update if personalData was already set (%s -> %s)",
    async (oldValue, newValue) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.published,
        interface: getMockDocument(),
      };

      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [eserviceTemplateVersion],
        personalData: oldValue,
      };

      await addOneEServiceTemplate(eserviceTemplate);

      await expect(
        eserviceTemplateService.updateEServiceTemplatePersonalDataFlagAfterPublication(
          eserviceTemplate.id,
          newValue,
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        eserviceTemplatePersonalDataFlagCanOnlyBeSetOnce(eserviceTemplate.id)
      );
    }
  );

  it.each([true, false])(
    "should throw eserviceTemplateNotFound if the template doesn't exist (flag=%s)",
    async (personalDataFlag) => {
      const eserviceTemplate = getMockEServiceTemplate();

      await expect(
        eserviceTemplateService.updateEServiceTemplatePersonalDataFlagAfterPublication(
          eserviceTemplate.id,
          personalDataFlag,
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(eserviceTemplateNotFound(eserviceTemplate.id));
    }
  );

  it.each([true, false])(
    "should throw operationForbidden if the requester is not the creator (flag=%s)",
    async (personalDataFlag) => {
      const eserviceTemplate = getMockEServiceTemplate();
      await addOneEServiceTemplate(eserviceTemplate);

      await expect(
        eserviceTemplateService.updateEServiceTemplatePersonalDataFlagAfterPublication(
          eserviceTemplate.id,
          personalDataFlag,
          getMockContext({})
        )
      ).rejects.toThrowError(operationForbidden);
    }
  );

  it.each([true, false])(
    "should throw eserviceTemplateWithoutPublishedVersion if the template has no published versions (flag=%s)",
    async (personalDataFlag) => {
      const eserviceTemplate: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        versions: [],
      };

      await addOneEServiceTemplate(eserviceTemplate);

      await expect(
        eserviceTemplateService.updateEServiceTemplatePersonalDataFlagAfterPublication(
          eserviceTemplate.id,
          personalDataFlag,
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
      );
    }
  );
});
