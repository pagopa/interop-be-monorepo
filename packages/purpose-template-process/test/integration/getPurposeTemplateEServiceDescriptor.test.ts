import {
  getMockAuthData,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  EService,
  EServiceDescriptorPurposeTemplate,
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  TenantId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addOneEService,
  addOnePurposeTemplate,
  addOnePurposeTemplateEServiceDescriptor,
  purposeTemplateService,
} from "../integrationUtils.js";
import {
  eServiceDescriptorPurposeTemplateNotFound,
  purposeTemplateNotFound,
} from "../../src/model/domain/errors.js";

describe("getPurposeTemplateEServiceDescriptor", async () => {
  const creatorId = generateId<TenantId>();

  const eservice1: EService = {
    ...getMockEService(),
    name: "Test e-service 1",
    descriptors: [getMockDescriptor(descriptorState.published)],
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

  const purposeTemplateEServiceDescriptor1: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: purposeTemplate1.id,
      eserviceId: eservice1.id,
      descriptorId: eservice1.descriptors[0].id,
      createdAt: new Date(),
    };

  beforeEach(async () => {
    await addOneEService(eservice1);

    await addOnePurposeTemplate(purposeTemplate1);
    await addOnePurposeTemplate(purposeTemplate2);

    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );
  });

  it("should get all the linked purpose template e-service descriptor if it exists", async () => {
    const allPurposeTemplateEServiceDescriptors =
      await purposeTemplateService.getPurposeTemplateEServiceDescriptor(
        purposeTemplate1.id,
        eservice1.id,
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      );

    expect(allPurposeTemplateEServiceDescriptors).toEqual(
      purposeTemplateEServiceDescriptor1
    );
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    const notExistingId = generateId<PurposeTemplateId>();

    await expect(
      purposeTemplateService.getPurposeTemplateEServiceDescriptor(
        notExistingId,
        eservice1.id,
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(notExistingId));
  });

  it("should throw purposeTemplateNotFound if the requester is not the creator and the purpose template is in draft state", async () => {
    const requesterId = generateId<TenantId>();
    const creatorId = generateId<TenantId>();
    const purposeTemplateDraft = getMockPurposeTemplate(
      creatorId,
      purposeTemplateState.draft
    );
    await addOnePurposeTemplate(purposeTemplateDraft);

    await expect(
      purposeTemplateService.getPurposeTemplateEServiceDescriptor(
        purposeTemplateDraft.id,
        eservice1.id,
        getMockContext({ authData: getMockAuthData(requesterId) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(purposeTemplateDraft.id));
  });

  it("should throw eServiceDescriptorPurposeTemplateNotFound if the purpose template doesn't exist", async () => {
    await expect(
      purposeTemplateService.getPurposeTemplateEServiceDescriptor(
        purposeTemplate2.id,
        eservice1.id,
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorPurposeTemplateNotFound(
        purposeTemplate2.id,
        eservice1.id
      )
    );
  });
});
