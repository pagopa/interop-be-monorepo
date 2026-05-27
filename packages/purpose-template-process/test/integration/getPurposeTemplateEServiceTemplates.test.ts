import {
  getMockAuthData,
  getMockContext,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  EServiceTemplateVersionPurposeTemplate,
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  TenantId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addOneEServiceTemplate,
  addOneEServiceTemplateVersionPurposeTemplate,
  addOnePurposeTemplate,
  purposeTemplateService,
} from "../integrationUtils.js";
import { purposeTemplateNotFound } from "../../src/model/domain/errors.js";

describe("getPurposeTemplateEServiceTemplates", async () => {
  const creatorId = generateId<TenantId>();

  const eserviceTemplate1: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    name: "Test e-service template 1",
    versions: [getMockEServiceTemplateVersion()],
  };
  const eserviceTemplate2: EServiceTemplate = {
    ...getMockEServiceTemplate(),
    name: "Test e-service template 2",
    versions: [getMockEServiceTemplateVersion()],
  };

  const purposeTemplate1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Published Purpose Template 1 - test",
    state: purposeTemplateState.published,
    creatorId,
  };
  const purposeTemplate2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Published Purpose Template 2 - test",
    state: purposeTemplateState.published,
    creatorId,
  };
  const purposeTemplate3: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Published Purpose Template 3 - test",
    state: purposeTemplateState.published,
    creatorId,
  };

  const link1: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId: purposeTemplate1.id,
    eserviceTemplateId: eserviceTemplate1.id,
    eserviceTemplateVersionId: eserviceTemplate1.versions[0].id,
    createdAt: new Date(),
  };
  const link2: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId: purposeTemplate1.id,
    eserviceTemplateId: eserviceTemplate2.id,
    eserviceTemplateVersionId: eserviceTemplate2.versions[0].id,
    createdAt: new Date(),
  };
  const link3: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId: purposeTemplate2.id,
    eserviceTemplateId: eserviceTemplate1.id,
    eserviceTemplateVersionId: eserviceTemplate1.versions[0].id,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    await addOneEServiceTemplate(eserviceTemplate1);
    await addOneEServiceTemplate(eserviceTemplate2);

    await addOnePurposeTemplate(purposeTemplate1);
    await addOnePurposeTemplate(purposeTemplate2);
    await addOnePurposeTemplate(purposeTemplate3);

    await addOneEServiceTemplateVersionPurposeTemplate(link1);
    await addOneEServiceTemplateVersionPurposeTemplate(link2);
    await addOneEServiceTemplateVersionPurposeTemplate(link3);
  });

  it("should get all the linked purpose template e-service templates if they exist", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        {
          purposeTemplateId: purposeTemplate1.id,
          creatorIds: [],
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      );

    expect(result).toEqual({
      results: [link1, link2],
      totalCount: 2,
    });
  });

  it("should get the linked purpose template e-service templates (pagination: offset)", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        {
          purposeTemplateId: purposeTemplate1.id,
          creatorIds: [],
        },
        { offset: 1, limit: 50 },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      );

    expect(result).toEqual({
      totalCount: 2,
      results: [link2],
    });
  });

  it("should get the linked purpose template e-service templates (pagination: limit)", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        {
          purposeTemplateId: purposeTemplate1.id,
          creatorIds: [],
        },
        { offset: 0, limit: 1 },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      );

    expect(result).toEqual({
      totalCount: 2,
      results: [link1],
    });
  });

  it("should get the linked purpose template e-service templates (filter: creatorIds)", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        {
          purposeTemplateId: purposeTemplate1.id,
          creatorIds: [eserviceTemplate2.creatorId],
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      );

    expect(result).toEqual({
      totalCount: 1,
      results: [link2],
    });
  });

  it("should get the linked purpose template e-service templates (filter: eserviceTemplateName)", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        {
          purposeTemplateId: purposeTemplate1.id,
          eserviceTemplateName: "E-SERVICE TEMPLATE 2",
          creatorIds: [],
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      );

    expect(result).toEqual({
      totalCount: 1,
      results: [link2],
    });
  });

  it("should not get the linked purpose template e-service templates if they don't exist", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        {
          purposeTemplateId: purposeTemplate3.id,
          creatorIds: [],
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      );

    expect(result).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    const notExistingId = generateId<PurposeTemplateId>();

    await expect(
      purposeTemplateService.getPurposeTemplateEServiceTemplates(
        {
          purposeTemplateId: notExistingId,
          creatorIds: [],
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(notExistingId));
  });

  it("should throw purposeTemplateNotFound if the requester is not the creator and the purpose template is in draft state", async () => {
    const purposeTemplateDraft = getMockPurposeTemplate();
    await addOnePurposeTemplate(purposeTemplateDraft);

    const requesterId = generateId<TenantId>();
    await expect(
      purposeTemplateService.getPurposeTemplateEServiceTemplates(
        {
          purposeTemplateId: purposeTemplateDraft.id,
          creatorIds: [],
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplateDraft.id));
  });
});
