import {
  getMockAuthData,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockPurposeTemplate,
  sortPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  EService,
  EServiceDescriptorPurposeTemplate,
  generateId,
  PurposeTemplate,
  purposeTemplateState,
  TenantId,
  tenantKind,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import { sortDirection } from "pagopa-interop-commons";
import {
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

  const activePurposeTemplateByCreator1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Active Purpose Template 1 - test",
    state: purposeTemplateState.active,
    creatorId: creatorId1,
    targetTenantKind: tenantKind.PRIVATE,
  };
  const draftPurposeTemplateByCreator1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Draft Purpose Template 1",
    state: purposeTemplateState.draft,
    creatorId: creatorId1,
    targetTenantKind: tenantKind.PRIVATE,
  };
  const suspendedPurposeTemplateByCreator1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Suspended Purpose Template 1",
    state: purposeTemplateState.suspended,
    creatorId: creatorId1,
    targetTenantKind: tenantKind.PA,
  };
  const archivedPurposeTemplateByCreator1: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Archived Purpose Template 1",
    state: purposeTemplateState.archived,
    creatorId: creatorId1,
    targetTenantKind: tenantKind.PA,
  };

  const activePurposeTemplateByCreator2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Active Purpose Template 2",
    state: purposeTemplateState.active,
    creatorId: creatorId2,
    targetTenantKind: tenantKind.PRIVATE,
  };
  const draftPurposeTemplateByCreator2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Draft Purpose Template 2",
    state: purposeTemplateState.draft,
    creatorId: creatorId2,
    targetTenantKind: tenantKind.PRIVATE,
  };
  const suspendedPurposeTemplateByCreator2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Suspended Purpose Template 2 - test",
    state: purposeTemplateState.suspended,
    creatorId: creatorId2,
    targetTenantKind: tenantKind.PA,
  };
  const archivedPurposeTemplateByCreator2: PurposeTemplate = {
    ...getMockPurposeTemplate(),
    purposeTitle: "Archived Purpose Template 2",
    state: purposeTemplateState.archived,
    creatorId: creatorId2,
    targetTenantKind: tenantKind.PA,
  };

  const purposeTemplateEServiceDescriptor1: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: activePurposeTemplateByCreator1.id,
      eserviceId: eservice1.id,
      descriptorId: eservice1.descriptors[0].id,
      createdAt: new Date(),
    };
  const purposeTemplateEServiceDescriptor2: EServiceDescriptorPurposeTemplate =
    {
      purposeTemplateId: activePurposeTemplateByCreator1.id,
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
    await addOnePurposeTemplate(activePurposeTemplateByCreator1);
    await addOnePurposeTemplate(draftPurposeTemplateByCreator1);
    await addOnePurposeTemplate(suspendedPurposeTemplateByCreator1);
    await addOnePurposeTemplate(archivedPurposeTemplateByCreator1);
    await addOnePurposeTemplate(activePurposeTemplateByCreator2);
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

  it("should get all purpose templates if no filters are provided", async () => {
    const allPurposeTemplates =
      await purposeTemplateService.getPurposeTemplates(
        {
          purposeTitle: undefined,
          eserviceIds: [],
          creatorIds: [],
          states: [],
        },
        {
          offset: 0,
          limit: 50,
          sortColumns: undefined,
          directions: undefined,
        },
        getMockContext({ authData: getMockAuthData(creatorId1) })
      );

    expectSinglePageListResult(allPurposeTemplates, [
      activePurposeTemplateByCreator1,
      activePurposeTemplateByCreator2,
      archivedPurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator2,
      draftPurposeTemplateByCreator1,
      draftPurposeTemplateByCreator2,
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
      {
        offset: 0,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [
      activePurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: eserviceIds", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [eservice1.id],
        creatorIds: [],
        states: [],
      },
      {
        offset: 0,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [
      activePurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates with filters: creatorIds", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [creatorId1],
        states: [],
      },
      {
        offset: 0,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expect(result.totalCount).toBe(4);

    expectSinglePageListResult(result, [
      activePurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator1,
      draftPurposeTemplateByCreator1,
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
      {
        offset: 0,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [activePurposeTemplateByCreator1]);
  });

  it("should get purpose templates with filters: states", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [purposeTemplateState.draft, purposeTemplateState.active],
      },
      {
        offset: 0,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result, [
      activePurposeTemplateByCreator1,
      activePurposeTemplateByCreator2,
      draftPurposeTemplateByCreator1,
      draftPurposeTemplateByCreator2,
    ]);

    const result2 = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [
          purposeTemplateState.archived,
          purposeTemplateState.active,
          purposeTemplateState.suspended,
        ],
      },
      {
        offset: 0,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result2, [
      activePurposeTemplateByCreator1,
      activePurposeTemplateByCreator2,
      archivedPurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator2,
      suspendedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });

  it("should get purpose templates (pagination: offset)", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [],
      },
      {
        offset: 2,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expect({
      ...result,
      results: result.results.map(sortPurposeTemplate),
    }).toEqual({
      totalCount: 8,
      results: [
        archivedPurposeTemplateByCreator1,
        archivedPurposeTemplateByCreator2,
        draftPurposeTemplateByCreator1,
        draftPurposeTemplateByCreator2,
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
      {
        offset: 0,
        limit: 2,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expect({
      ...result,
      results: result.results.map(sortPurposeTemplate),
    }).toEqual({
      totalCount: 8,
      results: [
        activePurposeTemplateByCreator1,
        activePurposeTemplateByCreator2,
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
      {
        offset: 0,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
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
      {
        offset: 0,
        limit: 50,
        sortColumns: undefined,
        directions: undefined,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );

    expectSinglePageListResult(result, [suspendedPurposeTemplateByCreator2]);
  });

  it("should get purpose templates with filters: sort, direction", async () => {
    const result = await purposeTemplateService.getPurposeTemplates(
      {
        eserviceIds: [],
        creatorIds: [],
        states: [],
      },
      {
        offset: 0,
        limit: 50,
        sortColumns: "targetTenantKind",
        directions: sortDirection.desc,
      },
      getMockContext({ authData: getMockAuthData(creatorId1) })
    );
    expectSinglePageListResult(result, [
      activePurposeTemplateByCreator1,
      activePurposeTemplateByCreator2,
      draftPurposeTemplateByCreator1,
      draftPurposeTemplateByCreator2,
      archivedPurposeTemplateByCreator1,
      archivedPurposeTemplateByCreator2,
      suspendedPurposeTemplateByCreator1,
      suspendedPurposeTemplateByCreator2,
    ]);
  });
});
