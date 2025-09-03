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
  addOnePurposeTemplate,
  addOnePurposeTemplateEServiceDescriptor,
  purposeTemplateService,
} from "../integrationUtils.js";
import { purposeTemplateNotFound } from "../../src/model/domain/errors.js";

describe("getPurposeTemplateEServiceDescriptors", async () => {
  const creatorId = generateId<TenantId>();

  const eservice1: EService = {
    ...getMockEService(),
    name: "e-service 1",
    descriptors: [getMockDescriptor(descriptorState.published)],
  };
  const eservice2: EService = {
    ...getMockEService(),
    name: "e-service 2",
    descriptors: [getMockDescriptor(descriptorState.archived)],
  };

  const purposeTemplate1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Active Purpose Template 1 - test",
    state: purposeTemplateState.active,
    creatorId,
  };
  const purposeTemplate2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Active Purpose Template 2 - test",
    state: purposeTemplateState.active,
    creatorId,
  };
  const purposeTemplate3: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Active Purpose Template 3 - test",
    state: purposeTemplateState.active,
    creatorId,
  };

  const purposeTemplateEServiceDescriptor1: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: purposeTemplate1.id,
      eserviceId: eservice1.id,
      descriptorId: eservice1.descriptors[0].id,
      createdAt: new Date(),
    };
  const purposeTemplateEServiceDescriptor2: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: purposeTemplate1.id,
      eserviceId: eservice2.id,
      descriptorId: eservice2.descriptors[0].id,
      createdAt: new Date(),
    };
  const purposeTemplateEServiceDescriptor4: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: purposeTemplate2.id,
      eserviceId: eservice1.id,
      descriptorId: eservice1.descriptors[0].id,
      createdAt: new Date(),
    };

  beforeEach(async () => {
    await addOnePurposeTemplate(purposeTemplate1);
    await addOnePurposeTemplate(purposeTemplate2);
    await addOnePurposeTemplate(purposeTemplate3);

    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor2
    );
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor4
    );
  });

  it("should get all the linked purpose template e-service descriptors if they exist", async () => {
    const allPurposeTemplateEServiceDescriptors =
      await purposeTemplateService.getPurposeTemplateEServiceDescriptors(
        purposeTemplate1.id,
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(creatorId) })
      );

    expect(allPurposeTemplateEServiceDescriptors).toEqual({
      results: [
        purposeTemplateEServiceDescriptor1,
        purposeTemplateEServiceDescriptor2,
      ],
      totalCount: 2,
    });
  });

  it("should get the linked purpose template e-service descriptors (pagination: offset)", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceDescriptors(
        purposeTemplate1.id,
        { offset: 1, limit: 50 },
        getMockContext({ authData: getMockAuthData(creatorId) })
      );

    expect(result).toEqual({
      totalCount: 2,
      results: [purposeTemplateEServiceDescriptor2],
    });
  });

  it("should get the linked purpose template e-service descriptors (pagination: limit)", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceDescriptors(
        purposeTemplate1.id,
        { offset: 0, limit: 1 },
        getMockContext({ authData: getMockAuthData(creatorId) })
      );

    expect(result).toEqual({
      totalCount: 2,
      results: [purposeTemplateEServiceDescriptor1],
    });
  });

  it("should not get the linked purpose template e-service descriptors if they don't exist", async () => {
    const result =
      await purposeTemplateService.getPurposeTemplateEServiceDescriptors(
        purposeTemplate3.id,
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(creatorId) })
      );

    expect(result).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should throw purposeTemplateNotFound if the purpose template doesn't exist", async () => {
    const notExistingId = generateId<PurposeTemplateId>();

    await expect(
      purposeTemplateService.getPurposeTemplateEServiceDescriptors(
        notExistingId,
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(generateId<TenantId>()) })
      )
    ).rejects.toThrowError(purposeTemplateNotFound(notExistingId));
  });
});
