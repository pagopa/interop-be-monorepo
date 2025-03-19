/* eslint-disable functional/no-let */
import { AuthData, userRoles } from "pagopa-interop-commons";
import {
  getRandomAuthData,
  getMockContext,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  TenantId,
  generateId,
  eserviceTemplateVersionState,
  Tenant,
  EServiceTemplate,
  EServiceTemplateVersion,
} from "pagopa-interop-models";
import { beforeEach, expect, describe, it } from "vitest";
import {
  addOneEServiceTemplate,
  addOneTenant,
  eserviceTemplateService,
} from "./utils.js";

describe("get eservices", () => {
  let organizationId1: TenantId;
  let organizationId2: TenantId;
  let organizationId3: TenantId;
  let eserviceTemplate1: EServiceTemplate;
  let eserviceTemplate2: EServiceTemplate;
  let eserviceTemplate3: EServiceTemplate;
  let eserviceTemplate4: EServiceTemplate;
  let eserviceTemplate5: EServiceTemplate;
  const mockEServiceTemplateVersion = getMockEServiceTemplateVersion();
  const mockEServiceTemplate = getMockEServiceTemplate();
  const mockDocument = getMockDocument();

  beforeEach(async () => {
    organizationId1 = generateId();
    organizationId2 = generateId();
    organizationId3 = generateId();

    const eserviceTemplateVersion1: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      interface: mockDocument,
      state: eserviceTemplateVersionState.published,
    };

    eserviceTemplate1 = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice 001 test",
      versions: [eserviceTemplateVersion1],
      creatorId: organizationId1,
    };
    await addOneEServiceTemplate(eserviceTemplate1);

    const eserviceTemplateVersion2: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      interface: mockDocument,
      state: eserviceTemplateVersionState.published,
    };

    eserviceTemplate2 = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 002 test",
      versions: [eserviceTemplateVersion2],
      creatorId: organizationId1,
    };
    await addOneEServiceTemplate(eserviceTemplate2);

    const eserviceTemplateVersion3: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      interface: mockDocument,
      state: eserviceTemplateVersionState.published,
    };
    eserviceTemplate3 = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 003 test",
      versions: [eserviceTemplateVersion3],
      creatorId: organizationId1,
    };
    await addOneEServiceTemplate(eserviceTemplate3);

    const eserviceTemplateVersion4: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      interface: mockDocument,
      state: eserviceTemplateVersionState.suspended,
    };
    eserviceTemplate4 = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 004 test",
      creatorId: organizationId2,
      versions: [eserviceTemplateVersion4],
    };
    await addOneEServiceTemplate(eserviceTemplate4);

    const eserviceTemplateVersion5: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      interface: mockDocument,
      state: eserviceTemplateVersionState.suspended,
    };
    eserviceTemplate5 = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 005",
      creatorId: organizationId2,
      versions: [eserviceTemplateVersion5],
    };
    await addOneEServiceTemplate(eserviceTemplate5);

    const tenant: Tenant = {
      ...getMockTenant(),
      id: organizationId3,
    };
    await addOneTenant(tenant);
  });
  it("should get the eService templates if they exist (parameters: eserviceTemplatesIds)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [eserviceTemplate1.id, eserviceTemplate2.id],
        creatorsIds: [],
        states: [],
      },
      0,
      50,
      getMockContext({})
    );
    expect(result.totalCount).toBe(2);
    expect(result.results).toEqual([eserviceTemplate1, eserviceTemplate2]);
  });
  it("should get the eServices templates if they exist (parameters: creatorsIds)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [organizationId1],
        states: [],
      },
      0,
      50,
      getMockContext({})
    );
    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
    ]);
  });
  it("should get the eServices templates if they exist (parameters: states)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [eserviceTemplateVersionState.published],
      },
      0,
      50,
      getMockContext({})
    );
    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
    ]);
  });
  it("should get the eServices templates if they exist (parameters: name)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
        name: "test",
      },
      0,
      50,
      getMockContext({})
    );
    expect(result.totalCount).toBe(4);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
      eserviceTemplate4,
    ]);
  });
  it("should get the eServices templates if they exist (parameters: states, name)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [eserviceTemplateVersionState.published],
        name: "test",
      },
      0,
      50,
      getMockContext({})
    );
    expect(result.totalCount).toBe(3);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
    ]);
  });
  it("should not get the eServices templates if they don't exist (parameters: states, name)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [eserviceTemplateVersionState.deprecated],
        name: "test",
      },
      0,
      50,
      getMockContext({})
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should get the eServices templates if they exist (parameters: creatorsIds, states, name)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [organizationId2],
        states: [eserviceTemplateVersionState.suspended],
        name: "test",
      },
      0,
      50,
      getMockContext({})
    );
    expect(result.totalCount).toBe(1);
    expect(result.results).toEqual([eserviceTemplate4]);
  });
  it("should not get the eServices templates if they don't exist (parameters: producersIds, states, name)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [organizationId2],
        states: [eserviceTemplateVersionState.published],
        name: "not-existing",
      },
      0,
      50,
      getMockContext({})
    );
    expect(result.totalCount).toBe(0);
    expect(result.results).toEqual([]);
  });
  it("should get the eServices templates if they exist (pagination: limit)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      0,
      2,
      getMockContext({})
    );

    expect(result.totalCount).toBe(5);
    expect(result.results.length).toBe(2);
  });
  it("should get the eServices templates if they exist (pagination: offset, limit)", async () => {
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      4,
      4,
      getMockContext({})
    );
    expect(result.totalCount).toBe(5);
    expect(result.results.length).toBe(1);
  });
  it("should include eservice templates with no versions (requester is the creator, admin)", async () => {
    const eserviceTemplate6: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [],
    };
    const authData: AuthData = {
      ...getRandomAuthData(organizationId1),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEServiceTemplate(eserviceTemplate6);
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      0,
      50,
      getMockContext({ authData })
    );
    expect(result.totalCount).toBe(6);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
      eserviceTemplate4,
      eserviceTemplate5,
      eserviceTemplate6,
    ]);
  });
  it("should include eservice templates whose only version is draft (requester is the creator, admin)", async () => {
    const eserviceTemplateVersion6: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate6: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [eserviceTemplateVersion6],
    };
    const authData: AuthData = {
      ...getRandomAuthData(organizationId1),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEServiceTemplate(eserviceTemplate6);
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      0,
      50,
      getMockContext({ authData })
    );
    expect(result.totalCount).toBe(6);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
      eserviceTemplate4,
      eserviceTemplate5,
      eserviceTemplate6,
    ]);
  });
  it("should not include eservice templates whose only version is draft (requester is the creator, not admin nor api, nor support)", async () => {
    const eserviceTemplateVersion6: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate6: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [eserviceTemplateVersion6],
    };
    const authData: AuthData = {
      ...getRandomAuthData(organizationId1),
      userRoles: [userRoles.SECURITY_ROLE],
    };
    await addOneEServiceTemplate(eserviceTemplate6);
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      0,
      50,
      getMockContext({ authData })
    );
    expect(result.totalCount).toBe(5);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
      eserviceTemplate4,
      eserviceTemplate5,
    ]);
  });
  it("should not include eservice templates whose only version is draft (requester is not the creator)", async () => {
    const eserviceTemplateVersion6: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate6: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [eserviceTemplateVersion6],
    };
    const authData: AuthData = {
      ...getRandomAuthData(),
      userRoles: [userRoles.SECURITY_ROLE],
    };
    await addOneEServiceTemplate(eserviceTemplate6);
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      0,
      50,
      getMockContext({ authData })
    );
    expect(result.totalCount).toBe(5);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
      eserviceTemplate4,
      eserviceTemplate5,
    ]);
  });
  it("should not filter out %s versions if the eservice template has both of draft and published versions (requester is the creator, admin)", async () => {
    const eserviceTemplateVersion6a: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      interface: mockDocument,
      publishedAt: new Date(),
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplateVersion6b: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      version: 2,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate6: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [eserviceTemplateVersion6a, eserviceTemplateVersion6b],
    };
    const authData: AuthData = {
      ...getRandomAuthData(organizationId1),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEServiceTemplate(eserviceTemplate6);
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      0,
      50,
      getMockContext({ authData })
    );
    expect(result.totalCount).toBe(6);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
      eserviceTemplate4,
      eserviceTemplate5,
      eserviceTemplate6,
    ]);
  });
  it("should filter out draft versions if the eservice has both draft and published versions (requester is the creator, but not admin nor api, nor support)", async () => {
    const eserviceTemplateVersion6a: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      interface: mockDocument,
      publishedAt: new Date(),
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplateVersion6b: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      version: 2,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate6: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [eserviceTemplateVersion6a, eserviceTemplateVersion6b],
    };
    const authData: AuthData = {
      ...getRandomAuthData(organizationId1),
      userRoles: [userRoles.SECURITY_ROLE],
    };
    await addOneEServiceTemplate(eserviceTemplate6);
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      0,
      50,
      getMockContext({ authData })
    );
    expect(result.totalCount).toBe(6);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
      eserviceTemplate4,
      eserviceTemplate5,
      { ...eserviceTemplate6, versions: [eserviceTemplateVersion6a] },
    ]);
  });
  it("should filter out draft versions if the eservice template has both of draft and published versions (requester is not the creator)", async () => {
    const eserviceTemplateVersion6a: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      interface: mockDocument,
      publishedAt: new Date(),
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplateVersion6b: EServiceTemplateVersion = {
      ...mockEServiceTemplateVersion,
      id: generateId(),
      version: 2,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate6: EServiceTemplate = {
      ...mockEServiceTemplate,
      id: generateId(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [eserviceTemplateVersion6a, eserviceTemplateVersion6b],
    };
    const authData: AuthData = {
      ...getRandomAuthData(),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEServiceTemplate(eserviceTemplate6);
    const result = await eserviceTemplateService.getEServiceTemplates(
      {
        eserviceTemplatesIds: [],
        creatorsIds: [],
        states: [],
      },
      0,
      50,
      getMockContext({ authData })
    );
    expect(result.totalCount).toBe(6);
    expect(result.results).toEqual([
      eserviceTemplate1,
      eserviceTemplate2,
      eserviceTemplate3,
      eserviceTemplate4,
      eserviceTemplate5,
      { ...eserviceTemplate6, versions: [eserviceTemplateVersion6a] },
    ]);
  });
});
