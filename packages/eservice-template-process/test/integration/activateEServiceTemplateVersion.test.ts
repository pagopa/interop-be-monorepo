/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
  descriptorState,
  toEServiceTemplateV2,
  operationForbidden,
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplateVersionActivatedV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import {
  eserviceTemplateService,
  addOneEServiceTemplate,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";

describe("activateEServiceTemplateVersion", () => {
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();
  const mockDocument = getMockDocument();

  it("should write on event-store for the activation of a eservice template version", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: mockDocument,
      state: descriptorState.suspended,
      suspendedAt: new Date(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    await eserviceTemplateService.activateEServiceTemplateVersion(
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
    expect(writtenEvent.type).toBe("EServiceTemplateVersionActivated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionActivatedV2,
      payload: writtenEvent.data,
    });

    const expectedEServiceTemplate = toEServiceTemplateV2({
      ...eserviceTemplate,
      versions: [
        {
          ...eserviceTemplateVersion,
          state: descriptorState.published,
          suspendedAt: undefined,
        },
      ],
    });

    expect(writtenPayload.eserviceTemplateVersionId).toEqual(
      eserviceTemplateVersion.id
    );
    expect(writtenPayload.eserviceTemplate).toEqual(expectedEServiceTemplate);
  });

  it("should throw eServiceTemplateNotFound if the eservice template doesn't exist", () => {
    expect(
      eserviceTemplateService.activateEServiceTemplateVersion(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the eservice template creator", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    expect(
      eserviceTemplateService.activateEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eServiceTemplateVersionNotFound if the eservice template version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.activateEServiceTemplateVersion(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eServiceTemplateVersionNotFound(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id
      )
    );
  });

  it.each([
    eserviceTemplateVersionState.draft,
    descriptorState.published,
    eserviceTemplateVersionState.deprecated,
  ])(
    "should throw notValidEServiceTemplateVersionState if the descriptor is in %s state",
    async (state) => {
      const eserviceTemplateVersion: EServiceTemplateVersion = {
        ...mockEServiceTemplateVersion,
        state,
      };
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        versions: [eserviceTemplateVersion],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      expect(
        eserviceTemplateService.activateEServiceTemplateVersion(
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
