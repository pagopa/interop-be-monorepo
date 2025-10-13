/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  randomArrayItem,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  toEServiceTemplateV2,
  EServiceTemplateAddedV2,
  generateId,
} from "pagopa-interop-models";
import { expect, describe, it, beforeAll, vi, afterAll } from "vitest";
import {
  eserviceTemplateDuplicate,
  inconsistentDailyCalls,
  originNotCompliant,
} from "../../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateService,
  postgresDB,
} from "../integrationUtils.js";
import { eserviceTemplateToApiEServiceTemplateSeed } from "../mockUtils.js";

describe("create eservice template", () => {
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockVersion = getMockEServiceTemplateVersion();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the creation of an eservice template", async () => {
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const eserviceTemplate =
      await eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed({
          ...mockEServiceTemplate,
          isSignalHubEnabled,
        }),
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      );

    expect(eserviceTemplate).toBeDefined();

    const eserviceTemplateCreationEvent = await readEventByStreamIdAndVersion(
      eserviceTemplate.data.id,
      0,
      "eservice_template",
      postgresDB
    );

    expect(eserviceTemplateCreationEvent).toMatchObject({
      stream_id: eserviceTemplate.data.id,
      version: "0",
      type: "EServiceTemplateAdded",
      event_version: 2,
    });

    const eserviceCreationPayload = decodeProtobufPayload({
      messageType: EServiceTemplateAddedV2,
      payload: eserviceTemplateCreationEvent.data,
    });

    const expectedEserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      createdAt: eserviceTemplate.data.createdAt,
      id: eserviceTemplate.data.id,
      versions: [
        {
          ...mockVersion,
          agreementApprovalPolicy:
            eserviceTemplate.data.versions[0].agreementApprovalPolicy,
          id: eserviceTemplate.data.versions[0].id,
          createdAt: eserviceTemplate.data.versions[0].createdAt,
        },
      ],
      isSignalHubEnabled,
    };

    expect(eserviceCreationPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(expectedEserviceTemplate)
    );

    expect(eserviceTemplate).toEqual({
      data: expectedEserviceTemplate,
      metadata: { version: 0 },
    });
  });

  it("should throw originNotCompliant if the requester is not in the allowed origins", async () => {
    await expect(
      eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed(mockEServiceTemplate),
        getMockContext({
          authData: {
            ...getMockAuthData(mockEServiceTemplate.creatorId),
            externalId: { origin: "not-allowed-origin", value: "aaa" },
          },
        })
      )
    ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
  });

  it("should throw eserviceTemplateDuplicate if an eservice template with the same name already exists, case insensitive", async () => {
    await addOneEServiceTemplate(mockEServiceTemplate);
    await expect(
      eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed(mockEServiceTemplate),
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateDuplicate(mockEServiceTemplate.name)
    );
  });

  it("should throw eserviceTemplateDuplicate if an eservice template with the same name with different creator already exists, case insensitive", async () => {
    await addOneEServiceTemplate({
      ...mockEServiceTemplate,
      creatorId: generateId(),
    });
    await expect(
      eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed(mockEServiceTemplate),
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateDuplicate(mockEServiceTemplate.name)
    );
  });

  it("should throw inconsistentDailyCalls if the version seed has dailyCallsPerConsumer > dailyCallsTotal", async () => {
    await expect(
      eserviceTemplateService.createEServiceTemplate(
        eserviceTemplateToApiEServiceTemplateSeed({
          ...mockEServiceTemplate,
          versions: [
            { ...mockVersion, dailyCallsPerConsumer: 2, dailyCallsTotal: 1 },
          ],
        }),
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
