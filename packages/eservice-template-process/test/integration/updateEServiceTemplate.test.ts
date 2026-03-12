/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockAuthData,
  randomArrayItem,
  readLastEventByStreamId,
  getMockValidEServiceTemplateRiskAnalysis,
} from "pagopa-interop-commons-test";
import {
  generateId,
  EServiceTemplate,
  EServiceTemplateDraftUpdatedV2,
  toEServiceTemplateV2,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  eserviceMode,
  operationForbidden,
  tenantKind,
} from "pagopa-interop-models";
import { vi, expect, describe, it } from "vitest";
import { config } from "../../src/config/config.js";
import {
  eserviceTemplateDuplicate,
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  fileManager,
  postgresDB,
} from "../integrationUtils.js";
import { eserviceTemplateToApiUpdateEServiceTemplateSeed } from "../mockUtils.js";

describe("update EService template", () => {
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockVersion = getMockEServiceTemplateVersion();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of an eService (no technology change)", async () => {
    vi.spyOn(fileManager, "delete");

    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [mockVersion],
    };
    const updatedName = "eservice template new name";
    await addOneEServiceTemplate(eserviceTemplate);

    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      name: updatedName,
      isSignalHubEnabled,
    };
    const returnedEServiceTemplate =
      await eserviceTemplateService.updateEServiceTemplate(
        mockEServiceTemplate.id,
        eserviceTemplateToApiUpdateEServiceTemplateSeed(
          updatedEServiceTemplate
        ),
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      );

    const writtenEvent = await readLastEventByStreamId(
      eserviceTemplate.id,
      "eservice_template",
      postgresDB
    );
    expect(writtenEvent.stream_id).toBe(mockEServiceTemplate.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceTemplateDraftUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDraftUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(updatedEServiceTemplate)
    );
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(returnedEServiceTemplate.data)
    );
    expect(fileManager.delete).not.toHaveBeenCalled();
  });

  it("should write on event-store for the update of an eService template (technology change: interface has to be deleted)", async () => {
    vi.spyOn(fileManager, "delete");

    const interfaceDocument = {
      ...mockDocument,
      name: mockDocument.name,
      path: `${config.eserviceTemplateDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
    };

    const version: EServiceTemplateVersion = {
      ...mockVersion,
      state: eserviceTemplateVersionState.draft,
      interface: interfaceDocument,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [version],
    };
    const updatedName = "eservice new name";

    await addOneEServiceTemplate(eserviceTemplate);

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

    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      name: updatedName,
      technology: "Soap",
      versions: eserviceTemplate.versions.map((v) => ({
        ...v,
        interface: undefined,
      })),
    };

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(interfaceDocument.path);

    const returnedEServiceTemplate =
      await eserviceTemplateService.updateEServiceTemplate(
        eserviceTemplate.id,
        eserviceTemplateToApiUpdateEServiceTemplateSeed(
          updatedEServiceTemplate
        ),
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const writtenEvent = await readLastEventByStreamId(
      eserviceTemplate.id,
      "eservice_template",
      postgresDB
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateDraftUpdated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDraftUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(updatedEServiceTemplate)
    );
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      interfaceDocument.path,
      genericLogger
    );
    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).not.toContain(interfaceDocument.path);
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(returnedEServiceTemplate.data)
    );
  });

  it("should write on event-store for the update of an eService (update mode to DELIVER so risk analysis has to be deleted)", async () => {
    const riskAnalysis = getMockValidEServiceTemplateRiskAnalysis(
      tenantKind.PA
    );
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
      riskAnalysis: [riskAnalysis],
      mode: "Receive",
    };
    await addOneEServiceTemplate(eserviceTemplate);

    const returnedEServiceTemplate =
      await eserviceTemplateService.updateEServiceTemplate(
        eserviceTemplate.id,
        {
          name: eserviceTemplate.name,
          intendedTarget: eserviceTemplate.intendedTarget,
          description: eserviceTemplate.description,
          technology: "REST",
          mode: "DELIVER",
          isSignalHubEnabled: eserviceTemplate.isSignalHubEnabled,
        },
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );

    const expectedEserviceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      mode: eserviceMode.deliver,
      riskAnalysis: [],
    };

    const writtenEvent = await readLastEventByStreamId(
      eserviceTemplate.id,
      "eservice_template",
      postgresDB
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateDraftUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateDraftUpdatedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(expectedEserviceTemplate)
    );
    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(returnedEServiceTemplate.data)
    );
  });

  it("should throw operationForbidden if the requester is not the creator", async () => {
    await addOneEServiceTemplate(mockEServiceTemplate);

    await expect(
      eserviceTemplateService.updateEServiceTemplate(
        mockEServiceTemplate.id,
        eserviceTemplateToApiUpdateEServiceTemplateSeed(mockEServiceTemplate),
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it.each([
    eserviceTemplateVersionState.suspended,
    eserviceTemplateVersionState.deprecated,
    eserviceTemplateVersionState.published,
  ])(
    "should throw eserviceTemplateNotInDraftState if the eservice template version is in %s state",
    async () => {
      const eserviceTemplate = {
        ...mockEServiceTemplate,
        versions: [
          { ...mockVersion, state: eserviceTemplateVersionState.published },
        ],
      };
      await addOneEServiceTemplate(eserviceTemplate);
      await expect(
        eserviceTemplateService.updateEServiceTemplate(
          eserviceTemplate.id,
          eserviceTemplateToApiUpdateEServiceTemplateSeed(eserviceTemplate),
          getMockContext({
            authData: getMockAuthData(eserviceTemplate.creatorId),
          })
        )
      ).rejects.toThrowError(
        eserviceTemplateNotInDraftState(eserviceTemplate.id)
      );
    }
  );

  it("should throw eserviceTemplateNotFound if the eservice template doesn't exist", async () => {
    expect(
      eserviceTemplateService.updateEServiceTemplate(
        mockEServiceTemplate.id,
        eserviceTemplateToApiUpdateEServiceTemplateSeed(mockEServiceTemplate),
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw eserviceTemplateDuplicate if the updated name is already in use, case insensitive", async () => {
    const eserviceTemplate1: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      versions: [],
    };
    const eserviceTemplate2: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      creatorId: generateId(),
      name: "eservice template name already in use",
      versions: [],
    };
    await addOneEServiceTemplate(eserviceTemplate1);
    await addOneEServiceTemplate(eserviceTemplate2);

    expect(
      eserviceTemplateService.updateEServiceTemplate(
        eserviceTemplate1.id,
        {
          name: "ESERVICE TEMPLATE NAME ALREADY IN USE",
          intendedTarget: eserviceTemplate1.intendedTarget,
          description: eserviceTemplate1.description,
          technology: "REST",
          mode: "DELIVER",
        },
        getMockContext({
          authData: getMockAuthData(eserviceTemplate1.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateDuplicate("ESERVICE TEMPLATE NAME ALREADY IN USE")
    );
  });
});
