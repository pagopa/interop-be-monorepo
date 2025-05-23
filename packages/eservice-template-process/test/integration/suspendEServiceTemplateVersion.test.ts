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
  EServiceTemplateVersionSuspendedV2,
  eserviceTemplateVersionState,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  notValidEServiceTemplateVersionState,
} from "../../src/model/domain/errors.js";
import {
  eserviceTemplateService,
  addOneEServiceTemplate,
  readLastEserviceTemplateEvent,
} from "../integrationUtils.js";

describe("suspendEServiceTemplateVersion", () => {
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();
  const mockDocument = getMockDocument();

  it("should write on event-store for the suspension of a eservice template version", async () => {
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
    await eserviceTemplateService.suspendEServiceTemplateVersion(
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
    expect(writtenEvent.type).toBe("EServiceTemplateVersionSuspended");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionSuspendedV2,
      payload: writtenEvent.data,
    });

    const expectedEServiceTemplate = toEServiceTemplateV2({
      ...eserviceTemplate,
      versions: [
        {
          ...eserviceTemplateVersion,
          state: descriptorState.suspended,
          suspendedAt: new Date(
            Number(writtenPayload.eserviceTemplate!.versions[0]!.suspendedAt)
          ),
        },
      ],
    });

    expect(writtenPayload.eserviceTemplateVersionId).toEqual(
      eserviceTemplateVersion.id
    );
    expect(writtenPayload.eserviceTemplate).toEqual(expectedEServiceTemplate);
  });

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", () => {
    expect(
      eserviceTemplateService.suspendEServiceTemplateVersion(
        mockEServiceTemplate.id,
        mockEServiceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
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
      eserviceTemplateService.suspendEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersion.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateVersionNotFound if the eservice template version doesn't exist", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.suspendEServiceTemplateVersion(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id,
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionNotFound(
        eserviceTemplate.id,
        mockEServiceTemplateVersion.id
      )
    );
  });

  it.each([
    eserviceTemplateVersionState.draft,
    descriptorState.suspended,
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
        eserviceTemplateService.suspendEServiceTemplateVersion(
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
