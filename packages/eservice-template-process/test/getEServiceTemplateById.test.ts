/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  generateId,
  EServiceTemplateId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  getMockAuthData,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import { eServiceTemplateNotFound } from "../src/model/domain/errors.js";
import { addOneEServiceTemplate, eserviceTemplateService } from "./utils.js";

describe("getEServiceTemplateById", () => {
  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();

  it("should get the eservice template if it exists (requester is the creator, admin)", async () => {
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: mockDocument,
      state: eserviceTemplateVersionState.published,
    };

    const eserviceTemplateDraftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: mockDocument,
      state: eserviceTemplateVersionState.draft,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice 001",
      versions: [eserviceTemplateVersion, eserviceTemplateDraftVersion],
    };

    await addOneEServiceTemplate(eserviceTemplate);

    const eserviceTemplateVersion2: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: mockDocument,
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplate2: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice 002",
      versions: [eserviceTemplateVersion2],
    };
    await addOneEServiceTemplate(eserviceTemplate2);

    const eserviceTemplateVersion3: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      interface: mockDocument,
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplate3: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice 003",
      versions: [eserviceTemplateVersion3],
    };
    await addOneEServiceTemplate(eserviceTemplate3);

    const result = await eserviceTemplateService.getEServiceTemplateById(
      eserviceTemplate.id,
      getMockContext({
        authData: getMockAuthData(eserviceTemplate.creatorId),
      })
    );
    expect(result).toEqual(eserviceTemplate);
  });

  it("should throw eServiceTemplateNotFound if the eservice template doesn't exist", async () => {
    await addOneEServiceTemplate(mockEServiceTemplate);
    const notExistingId: EServiceTemplateId = generateId();
    expect(
      eserviceTemplateService.getEServiceTemplateById(
        notExistingId,
        getMockContext({})
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(notExistingId));
  });

  it("should throw eServiceTemplateNotFound if there is only a draft version (requester is not the creator)", async () => {
    const eserviceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(mockEServiceTemplate);
    expect(
      eserviceTemplateService.getEServiceTemplateById(
        eserviceTemplate.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(eserviceTemplate.id));
  });

  it("should throw eServiceTemplateNotFound if there are no versions (requester is not the creator)", async () => {
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [],
    };
    await addOneEServiceTemplate(mockEServiceTemplate);
    expect(
      eserviceTemplateService.getEServiceTemplateById(
        eserviceTemplate.id,
        getMockContext({})
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(eserviceTemplate.id));
  });

  it("should filter out the draft versions if the eservice template has both of that state and not (requester is not the creator)", async () => {
    const eserviceTemplateVersionDraft: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      state: eserviceTemplateVersionState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [eserviceTemplateVersionDraft, eserviceTemplateVersion],
    };
    await addOneEServiceTemplate(eserviceTemplate);
    const result = await eserviceTemplateService.getEServiceTemplateById(
      eserviceTemplate.id,
      getMockContext({})
    );
    expect(result.versions).toEqual([eserviceTemplateVersion]);
  });
});
