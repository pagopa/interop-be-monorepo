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
  EServiceTemplateVersionAddedV2,
  toEServiceTemplateV2,
  EServiceTemplateVersion,
  operationForbidden,
  eserviceTemplateVersionState,
  EServiceTemplate,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  draftEServiceTemplateVersionAlreadyExists,
  eserviceTemplateNotFound,
  eserviceTemplateWithoutPublishedVersion,
} from "../../src/model/domain/errors.js";
import {
  eserviceTemplateService,
  readLastEserviceTemplateEvent,
  addOneEServiceTemplate,
} from "../integrationUtils.js";
import { eserviceTemplateToApiEServiceTemplateSeed } from "../mockUtils.js";

describe("createEServiceTemplateVersion", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const publishedTemplateVersion: EServiceTemplateVersion = {
    ...getMockEServiceTemplateVersion(),
    state: eserviceTemplateVersionState.published,
    interface: getMockDocument(),
    version: 1,
  };

  it("should write on event-store for the creation of an e-service template version", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);
    const eserviceTemplateVersionSeed =
      eserviceTemplateApi.VersionSeedForEServiceTemplateCreation.strip().parse({
        ...getMockEServiceTemplateVersion(),
        agreementApprovalPolicy: "AUTOMATIC",
      });
    const returnedEServiceTemplateVersion =
      await eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      );
    const newEServiceTemplateVersionId = returnedEServiceTemplateVersion.id;
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );

    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateVersionAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateVersionAddedV2,
      payload: writtenEvent.data,
    });

    const expectedEserviceTemplate = toEServiceTemplateV2({
      ...eserviceTemplate,
      versions: [
        publishedTemplateVersion,
        {
          ...publishedTemplateVersion,
          interface: undefined,
          version: 2,
          state: eserviceTemplateVersionState.draft,
          createdAt: new Date(),
          id: newEServiceTemplateVersionId,
        },
      ],
    });

    expect(writtenPayload).toEqual({
      eserviceTemplateVersionId: newEServiceTemplateVersionId,
      eserviceTemplate: expectedEserviceTemplate,
    });
  });

  it("should throw draftEServiceTemplateVersionAlreadyExists if an e-service template version draft already exists", async () => {
    const eserviceTemplateDraftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion, eserviceTemplateDraftVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);
    const eserviceTemplateVersionSeed =
      eserviceTemplateToApiEServiceTemplateSeed(eserviceTemplate).version;
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      draftEServiceTemplateVersionAlreadyExists(eserviceTemplate.id)
    );
  });

  it("should throw eserviceTemplateWithoutPublishedVersion if the e-service template has no published versions", async () => {
    const eserviceTemplateDraftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eserviceTemplateDraftVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);
    const eserviceTemplateVersionSeed =
      eserviceTemplateToApiEServiceTemplateSeed(eserviceTemplate).version;
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionSeed,
        getMockContext({
          authData: getMockAuthData(eserviceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(
      eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id)
    );
  });

  it("should throw eserviceTemplateNotFound if the eservice doesn't exist", async () => {
    const mockEServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion],
    };
    const eserviceTemplateVersionSeed =
      eserviceTemplateToApiEServiceTemplateSeed(mockEServiceTemplate).version;
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        mockEServiceTemplate.id,
        eserviceTemplateVersionSeed,
        getMockContext({
          authData: getMockAuthData(mockEServiceTemplate.creatorId),
        })
      )
    ).rejects.toThrowError(eserviceTemplateNotFound(mockEServiceTemplate.id));
  });

  it("should throw operationForbidden if the requester is not the template creator", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [publishedTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    const eserviceTemplateVersionSeed =
      eserviceTemplateToApiEServiceTemplateSeed(eserviceTemplate).version;
    expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        eserviceTemplate.id,
        eserviceTemplateVersionSeed,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
});
