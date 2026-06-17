/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockAuthData,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  EService,
  EServiceDescriptorPurposeTemplate,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  EServiceTemplateVersionPurposeTemplate,
  generateId,
  PurposeTemplate,
  purposeTemplateState,
  TenantId,
  targetTenantKind,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOneEServiceTemplateVersionPurposeTemplate,
  addOnePurposeTemplate,
  addOnePurposeTemplateEServiceDescriptor,
  expectSinglePageListResult,
  purposeTemplateService,
} from "../integrationUtils.js";

describe("getPurposeTemplates", async () => {
  const creatorId1 = generateId<TenantId>();
  const creatorId2 = generateId<TenantId>();

  const eservice1: EService = {
    ...getMockEService(),
    name: "eService 1",
    descriptors: [getMockDescriptor(descriptorState.published)],
  };
  const eservice2: EService = {
    ...getMockEService(),
    name: "eService 2",
    descriptors: [getMockDescriptor(descriptorState.archived)],
  };

  const publishedPurposeTemplateByCreator1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Published Purpose Template 1 - test",
    state: purposeTemplateState.published,
    creatorId: creatorId1,
    targetTenantKind: targetTenantKind.PA,
    handlesPersonalData: true,
  };
  const draftPurposeTemplateByCreator1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Draft Purpose Template 1",
    state: purposeTemplateState.draft,
    creatorId: creatorId1,
    targetTenantKind: targetTenantKind.PRIVATE,
    handlesPersonalData: false,
  };
  const suspendedPurposeTemplateByCreator1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Suspended Purpose Template 1",
    state: purposeTemplateState.suspended,
    creatorId: creatorId1,
    targetTenantKind: targetTenantKind.PRIVATE,
    handlesPersonalData: false,
  };
  const archivedPurposeTemplateByCreator1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Archived Purpose Template 1",
    state: purposeTemplateState.archived,
    creatorId: creatorId1,
    targetTenantKind: targetTenantKind.PRIVATE,
    handlesPersonalData: false,
  };

  const publishedPurposeTemplateByCreator2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Published Purpose Template 2",
    state: purposeTemplateState.published,
    creatorId: creatorId2,
    targetTenantKind: targetTenantKind.PA,
    handlesPersonalData: false,
  };
  const draftPurposeTemplateByCreator2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Draft Purpose Template 2",
    state: purposeTemplateState.draft,
    creatorId: creatorId2,
    targetTenantKind: targetTenantKind.PRIVATE,
    handlesPersonalData: false,
  };
  const suspendedPurposeTemplateByCreator2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Suspended Purpose Template 2 - test",
    state: purposeTemplateState.suspended,
    creatorId: creatorId2,
    targetTenantKind: targetTenantKind.PRIVATE,
    handlesPersonalData: true,
  };
  const archivedPurposeTemplateByCreator2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Archived Purpose Template 2",
    state: purposeTemplateState.archived,
    creatorId: creatorId2,
    targetTenantKind: targetTenantKind.PRIVATE,
    handlesPersonalData: false,
  };

  const purposeTemplateEServiceDescriptor1: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: publishedPurposeTemplateByCreator1.id,
      eserviceId: eservice1.id,
      descriptorId: eservice1.descriptors[0].id,
      createdAt: new Date(),
    };
  const purposeTemplateEServiceDescriptor2: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: publishedPurposeTemplateByCreator1.id,
      eserviceId: eservice2.id,
      descriptorId: eservice2.descriptors[0].id,
      createdAt: new Date(),
    };
  const purposeTemplateEServiceDescriptor3: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: suspendedPurposeTemplateByCreator2.id,
      eserviceId: eservice1.id,
      descriptorId: eservice1.descriptors[0].id,
      createdAt: new Date(),
    };

  beforeEach(async () => {
    await addOnePurposeTemplate(publishedPurposeTemplateByCreator1);
    await addOnePurposeTemplate(draftPurposeTemplateByCreator1);
    await addOnePurposeTemplate(suspendedPurposeTemplateByCreator1);
    await addOnePurposeTemplate(archivedPurposeTemplateByCreator1);
    await addOnePurposeTemplate(publishedPurposeTemplateByCreator2);
    await addOnePurposeTemplate(draftPurposeTemplateByCreator2);
    await addOnePurposeTemplate(suspendedPurposeTemplateByCreator2);
    await addOnePurposeTemplate(archivedPurposeTemplateByCreator2);

    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor1
    );

    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor2
    );
    await addOnePurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor3
    );
  });

  it("should get all the active, archived, suspended purpose templates and all the draft purpose templates created by the requester if no filters are provided", async () => {
    const allPurposeTemplates =
      await purposeTemplateService.getPurposeTemplates(
        {
          eserviceIds: [],
          creatorIds: [],
          states: [],
        },
        { offset: 0, limit: 50 },
        getMockContext({ authData: getMockAuthData(creatorId1) })
      );

    expectSinglePageListResult(allPurposeTemplates, [
      archivedPurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator2,
      draftPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator2,
      suspendedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: purposeTitle", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        purposeTitle: "test",
        eserviceIds: [],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [
      publishedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: targetTenantKind", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        targetTenantKind: targetTenantKind.PA,
        eserviceIds: [],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [
      publishedPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: eserviceIds", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [eservice1.id],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [
      publishedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should not get purpose templates if they don't exist (filters: eserviceIds)", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [generateId()],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, []);
  });

  it("should get purpose templates with filters: creatorIds", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [creatorId1],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expect(result.totalCount).toBe(4);

    expectSinglePageListResult(result, [
      archivedPurposeTemplateByCreator1,
      draftPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator1,
    ]);
  });

  it("should get purpose templates with filters: eserviceIds, creatorIds", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [eservice1.id],
        creatorIds: [creatorId1],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [publishedPurposeTemplateByCreator1]);
  });

  it("should get purpose templates with filters: states", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [purposeTemplateState.draft, purposeTemplateState.published],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result, [
      draftPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator2,
    ]);

    const result2 = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [
          purposeTemplateState.archived,
          purposeTemplateState.published,
          purposeTemplateState.suspended,
        ],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result2, [
      archivedPurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator2,
      publishedPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator2,
      suspendedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: excludeExpiredRiskAnalysis = false", async () => {
    const purposeTemplateWithExpiredRiskAnalysis1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeTitle: "Purpose Template with Expired Risk Analysis 1",
      purposeRiskAnalysisForm: {
        ...getMockValidRiskAnalysisFormTemplate(targetTenantKind.PA),
        version: "1.0",
      },
      state: purposeTemplateState.published,
    };
    const purposeTemplateWithExpiredRiskAnalysis2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeTitle: "Purpose Template with Expired Risk Analysis 2",
      targetTenantKind: targetTenantKind.PRIVATE,
      purposeRiskAnalysisForm: {
        ...getMockValidRiskAnalysisFormTemplate(targetTenantKind.PRIVATE),
        version: "1.0",
      },
      state: purposeTemplateState.published,
    };
    await addOnePurposeTemplate(purposeTemplateWithExpiredRiskAnalysis1);
    await addOnePurposeTemplate(purposeTemplateWithExpiredRiskAnalysis2);

    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [],
        excludeExpiredRiskAnalysis: false,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result, [
      archivedPurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator2,
      draftPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator2,
      purposeTemplateWithExpiredRiskAnalysis1,
      purposeTemplateWithExpiredRiskAnalysis2,
      suspendedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: excludeExpiredRiskAnalysis = true", async () => {
    const purposeTemplateWithExpiredRiskAnalysis1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeTitle: "Purpose Template with Expired Risk Analysis 1",
      purposeRiskAnalysisForm: {
        ...getMockValidRiskAnalysisFormTemplate(targetTenantKind.PA),
        version: "2.0",
      },
    };
    const purposeTemplateWithExpiredRiskAnalysis2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeTitle: "Purpose Template with Expired Risk Analysis 2",
      targetTenantKind: targetTenantKind.PRIVATE,
      purposeRiskAnalysisForm: {
        ...getMockValidRiskAnalysisFormTemplate(targetTenantKind.PRIVATE),
        version: "1.0",
      },
    };

    await addOnePurposeTemplate(purposeTemplateWithExpiredRiskAnalysis1);
    await addOnePurposeTemplate(purposeTemplateWithExpiredRiskAnalysis2);

    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [],
        excludeExpiredRiskAnalysis: true,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result, [
      archivedPurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator2,
      draftPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator2,
      suspendedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: handlesPersonalData = true", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [],
        handlesPersonalData: true,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result, [
      publishedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: handlesPersonalData = false", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [],
        handlesPersonalData: false,
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result, [
      archivedPurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator2,
      draftPurposeTemplateByCreator1,
      publishedPurposeTemplateByCreator2,
      suspendedPurposeTemplateByCreator1,
    ]);
  });

  it("should get purpose templates (pagination: offset)", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [],
      },
      { offset: 2, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expect({
      ...result,
      results: result.results.map(sortPurposeTemplate),
    }).toEqual({
      totalCount: 7,
      results: [
        draftPurposeTemplateByCreator1,
        publishedPurposeTemplateByCreator1,
        publishedPurposeTemplateByCreator2,
        suspendedPurposeTemplateByCreator1,
        suspendedPurposeTemplateByCreator2,
      ].map(sortPurposeTemplate),
    });
  });

  it("should get purpose templates (pagination: limit)", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 2 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expect({
      ...result,
      results: result.results.map(sortPurposeTemplate),
    }).toEqual({
      totalCount: 7,
      results: [
        archivedPurposeTemplateByCreator1,
        archivedPurposeTemplateByCreator2,
      ].map(sortPurposeTemplate),
    });
  });

  it("should not get purpose templates if they don't exist", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [generateId()],
        creatorIds: [generateId()],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expect(result).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it("should get purpose templates with filters: purposeTitle, eserviceIds, creatorIds, states", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        purposeTitle: "test",
        eserviceIds: [eservice1.id],
        creatorIds: [creatorId2],
        states: [purposeTemplateState.draft, purposeTemplateState.suspended],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [suspendedPurposeTemplateByCreator2]);
  });
});

describe("getPurposeTemplates - e-service template instance resolution", async () => {
  const creatorId = generateId<TenantId>();
  const otherCreatorId = generateId<TenantId>();

  const linkedEServiceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(generateId<EServiceTemplateId>(), creatorId),
  };
  const unlinkedEServiceTemplate: EServiceTemplate = {
    ...getMockEServiceTemplate(generateId<EServiceTemplateId>(), creatorId),
  };

  const instanceEService: EService = {
    ...getMockEService(),
    name: "instance of linked template",
    templateId: linkedEServiceTemplate.id,
    descriptors: [getMockDescriptor(descriptorState.published)],
  };
  const standaloneEService: EService = {
    ...getMockEService(),
    name: "standalone eservice",
    descriptors: [getMockDescriptor(descriptorState.published)],
  };
  const instanceOfUnlinkedTemplate: EService = {
    ...getMockEService(),
    name: "instance of unlinked template",
    templateId: unlinkedEServiceTemplate.id,
    descriptors: [getMockDescriptor(descriptorState.published)],
  };

  const ptViaTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "A - linked via template",
    state: purposeTemplateState.published,
    creatorId,
  };
  const ptViaConcrete: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "B - linked via concrete eservice",
    state: purposeTemplateState.published,
    creatorId,
  };
  const ptViaBoth: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "C - linked via both",
    state: purposeTemplateState.published,
    creatorId,
  };
  const draftPtViaTemplate: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "D - draft linked via template",
    state: purposeTemplateState.draft,
    creatorId,
  };

  const concreteLinkViaConcrete: EServiceDescriptorPurposeTemplate = {
    purposeTemplateId: ptViaConcrete.id,
    eserviceId: standaloneEService.id,
    descriptorId: standaloneEService.descriptors[0].id,
    createdAt: new Date(),
  };
  const concreteLinkViaBoth: EServiceDescriptorPurposeTemplate = {
    purposeTemplateId: ptViaBoth.id,
    eserviceId: standaloneEService.id,
    descriptorId: standaloneEService.descriptors[0].id,
    createdAt: new Date(),
  };

  const templateLinkViaTemplate: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId: ptViaTemplate.id,
    eserviceTemplateId: linkedEServiceTemplate.id,
    eserviceTemplateVersionId: generateId<EServiceTemplateVersionId>(),
    createdAt: new Date(),
  };
  const templateLinkViaBoth: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId: ptViaBoth.id,
    eserviceTemplateId: linkedEServiceTemplate.id,
    eserviceTemplateVersionId: linkedEServiceTemplate.versions[0].id,
    createdAt: new Date(),
  };
  const templateLinkViaDraft: EServiceTemplateVersionPurposeTemplate = {
    purposeTemplateId: draftPtViaTemplate.id,
    eserviceTemplateId: linkedEServiceTemplate.id,
    eserviceTemplateVersionId: linkedEServiceTemplate.versions[0].id,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    await addOneEServiceTemplate(linkedEServiceTemplate);
    await addOneEServiceTemplate(unlinkedEServiceTemplate);
    await addOneEService(instanceEService);
    await addOneEService(standaloneEService);
    await addOneEService(instanceOfUnlinkedTemplate);

    await addOnePurposeTemplate(ptViaTemplate);
    await addOnePurposeTemplate(ptViaConcrete);
    await addOnePurposeTemplate(ptViaBoth);
    await addOnePurposeTemplate(draftPtViaTemplate);

    await addOnePurposeTemplateEServiceDescriptor(concreteLinkViaConcrete);
    await addOnePurposeTemplateEServiceDescriptor(concreteLinkViaBoth);

    await addOneEServiceTemplateVersionPurposeTemplate(templateLinkViaTemplate);
    await addOneEServiceTemplateVersionPurposeTemplate(templateLinkViaBoth);
    await addOneEServiceTemplateVersionPurposeTemplate(templateLinkViaDraft);
  });

  it("should suggest purpose templates linked to the originating e-service template when the queried e-service is an instance (version-independent)", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [instanceEService.id],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId) })
    );

    expectSinglePageListResult(result, [
      ptViaTemplate,
      ptViaBoth,
      draftPtViaTemplate,
    ]);
  });

  it("should still match concrete links, and match resources linked via either kind (OR)", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [standaloneEService.id],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId) })
    );

    expectSinglePageListResult(result, [ptViaConcrete, ptViaBoth]);
  });

  it("should match across multiple e-service ids (template instance + standalone concrete)", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [instanceEService.id, standaloneEService.id],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId) })
    );

    expect(result.totalCount).toBe(4);
    expectSinglePageListResult(result, [
      ptViaTemplate,
      ptViaConcrete,
      ptViaBoth,
      draftPtViaTemplate,
    ]);
  });

  it("should not suggest purpose templates for an instance whose template has no linked purpose template", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [instanceOfUnlinkedTemplate.id],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId) })
    );

    expectSinglePageListResult(result, []);
  });

  it("should not error and return empty for a non-existent e-service id", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [generateId()],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(creatorId) })
    );

    expectSinglePageListResult(result, []);
  });

  it("should keep draft template-linked purpose templates hidden from non-creators", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [instanceEService.id],
        creatorIds: [],
        states: [],
      },
      { offset: 0, limit: 50 },
      getMockContext({ authData: getMockAuthData(otherCreatorId) })
    );

    expectSinglePageListResult(result, [ptViaTemplate, ptViaBoth]);
  });
});
