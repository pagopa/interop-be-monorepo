/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockEServiceTemplate,
  getMockContextM2MAdmin,
} from "pagopa-interop-commons-test";
import {
  operationForbidden,
  EServiceTemplate,
  EServiceTemplateDraftUpdatedV2,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  readLastEserviceTemplateEvent,
  addOneEServiceTemplate,
  eserviceTemplateService,
} from "../integrationUtils.js";
import {
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../../src/model/domain/apiConverter.js";
import { eServiceTemplateNotFound } from "../../../catalog-process/src/model/domain/errors.js";
import { eserviceTemplateDuplicate } from "../../src/model/domain/errors.js";

describe("update eserviceTemplate", () => {
  const mockEServiceTemplate = {
    ...getMockEServiceTemplate(),
    isSignalHubEnabled: false,
  };

  it.each([
    {}, // This should not throw an error and leave all fields unchanged
    {
      name: "New name",
    },
    {
      name: "New name",
      description: "New description",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
    },
    {
      name: "New name",
      description: "New description",
      technology: "SOAP",
      mode: "DELIVER",
      isSignalHubEnabled: true,
      intendedTarget: "intendedTarget",
    },
  ] as eserviceTemplateApi.PatchUpdateEServiceTemplateSeed[])(
    "should write on event-store and update only the fields set in the seed, and leave undefined fields unchanged (seed #%#)",
    async (seed) => {
      const eserviceTemplate: EServiceTemplate = {
        ...mockEServiceTemplate,
        technology: "Rest",
        mode: "Receive",
        isSignalHubEnabled: false,
        intendedTarget: "old intended target",
      };

      await addOneEServiceTemplate(eserviceTemplate);

      const updateEServiceTemplateReturn =
        await eserviceTemplateService.patchUpdateEServiceTemplate(
          mockEServiceTemplate.id,
          seed,
          getMockContextM2MAdmin({
            organizationId: mockEServiceTemplate.creatorId,
          })
        );

      const expectedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate,
        name: seed.name ?? eserviceTemplate.name,
        description: seed.description ?? eserviceTemplate.description,
        technology: seed.technology
          ? apiTechnologyToTechnology(seed.technology)
          : eserviceTemplate.technology,
        mode: seed.mode
          ? apiEServiceModeToEServiceMode(seed.mode)
          : eserviceTemplate.mode,
        isSignalHubEnabled:
          seed.isSignalHubEnabled ?? eserviceTemplate.isSignalHubEnabled,
        intendedTarget: seed.intendedTarget ?? eserviceTemplate.intendedTarget,
        riskAnalysis:
          seed.mode === "DELIVER" ? [] : eserviceTemplate.riskAnalysis,
      };

      const writtenEvent = await readLastEserviceTemplateEvent(
        mockEServiceTemplate.id
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockEServiceTemplate.id,
        version: "1",
        type: "EServiceTemplateDraftUpdated",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceTemplateDraftUpdatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.eserviceTemplate).toEqual(
        toEServiceTemplateV2(expectedEServiceTemplate)
      );
      expect(updateEServiceTemplateReturn).toEqual({
        data: expectedEServiceTemplate,
        metadata: { version: 1 },
      });
    }
  );

  it("should throw eServiceTemplateNotFound if the eserviceTemplate doesn't exist", async () => {
    expect(
      eserviceTemplateService.patchUpdateEServiceTemplate(
        mockEServiceTemplate.id,
        {
          name: "eserviceTemplate new name",
          description: "eserviceTemplate description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({
          organizationId: mockEServiceTemplate.creatorId,
        })
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEServiceTemplate(mockEServiceTemplate);

    expect(
      eserviceTemplateService.patchUpdateEServiceTemplate(
        mockEServiceTemplate.id,
        {
          name: "eserviceTemplate new name",
          description: "eserviceTemplate description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceTemplateDuplicateName if the updated name is already in use, case insensitive", async () => {
    const name = "eserviceTemplate name already in use";

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name,
    };

    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      eserviceTemplateService.patchUpdateEServiceTemplate(
        eserviceTemplate.id,
        {
          name: name.toUpperCase(),
          description: "eserviceTemplate description",
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContextM2MAdmin({ organizationId: eserviceTemplate.creatorId })
      )
    ).rejects.toThrowError(eserviceTemplateDuplicate(name.toUpperCase()));
  });
});
