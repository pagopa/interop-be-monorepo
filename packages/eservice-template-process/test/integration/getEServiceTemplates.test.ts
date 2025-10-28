/* eslint-disable functional/no-let */
import { UIAuthData, userRole } from "pagopa-interop-commons";
import {
  getMockAuthData,
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
  UserId,
} from "pagopa-interop-models";
import { beforeEach, expect, describe, it } from "vitest";
import {
  addOneEServiceTemplate,
  addOneTenant,
  eserviceTemplateService,
} from "../integrationUtils.js";
import { getContextsAllowedToSeeDraftVersions } from "../mockUtils.js";

describe("get eservice templates", () => {
  const organizationId1: TenantId = generateId();
  const organizationId2: TenantId = generateId();
  const organizationId3: TenantId = generateId();
  let eserviceTemplate1: EServiceTemplate;
  let eserviceTemplate2: EServiceTemplate;
  let eserviceTemplate3: EServiceTemplate;
  let eserviceTemplate4: EServiceTemplate;
  let eserviceTemplate5: EServiceTemplate;

  beforeEach(async () => {
    const eserviceTemplateVersion1: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };

    eserviceTemplate1 = {
      ...getMockEServiceTemplate(),
      name: "eservice 001 test",
      versions: [eserviceTemplateVersion1],
      creatorId: organizationId1,
      personalData: true,
    };
    await addOneEServiceTemplate(eserviceTemplate1);

    const eserviceTemplateVersion2: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };

    eserviceTemplate2 = {
      ...getMockEServiceTemplate(),
      name: "eservice template 002 test",
      versions: [eserviceTemplateVersion2],
      creatorId: organizationId1,
      personalData: true,
    };
    await addOneEServiceTemplate(eserviceTemplate2);

    const eserviceTemplateVersion3: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.published,
    };
    eserviceTemplate3 = {
      ...getMockEServiceTemplate(),
      name: "eservice template 003 test",
      versions: [eserviceTemplateVersion3],
      creatorId: organizationId1,
      personalData: false,
    };
    await addOneEServiceTemplate(eserviceTemplate3);

    const eserviceTemplateVersion4: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.suspended,
    };
    eserviceTemplate4 = {
      ...getMockEServiceTemplate(),
      name: "eservice template 004 test",
      creatorId: organizationId2,
      versions: [eserviceTemplateVersion4],
      personalData: false,
    };
    await addOneEServiceTemplate(eserviceTemplate4);

    const eserviceTemplateVersion5: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.suspended,
    };
    eserviceTemplate5 = {
      ...getMockEServiceTemplate(),
      name: "eservice template 005",
      creatorId: organizationId2,
      versions: [eserviceTemplateVersion5],
      personalData: false,
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
    expect(result.results).toEqual(
      [eserviceTemplate1, eserviceTemplate2].map((e) => ({
        ...e,
        versions: expect.arrayContaining(e.versions),
      }))
    );
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

  it.each(getContextsAllowedToSeeDraftVersions(organizationId1))(
    "should include eservice templates with no versions (requester is the creator, user roles: $authData.userRoles, system role: $authData.systemRole)",
    async (context) => {
      const eserviceTemplate6: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        name: "eservice template 006",
        creatorId: organizationId1,
        versions: [],
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
        context
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
    }
  );

  it.each(getContextsAllowedToSeeDraftVersions(organizationId1))(
    "should include eservice templates whose only version is draft (requester is the creator, user roles: $authData.userRoles, system role: $authData.systemRole)",
    async (context) => {
      const eserviceTemplateVersion6: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
      };
      const eserviceTemplate6: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        name: "eservice template 006",
        creatorId: organizationId1,
        versions: [eserviceTemplateVersion6],
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
        context
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
    }
  );

  it("should not include eservice templates whose only version is draft (requester is the creator, but user role is 'security')", async () => {
    const eserviceTemplateVersion6: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate6: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [eserviceTemplateVersion6],
    };
    const authData: UIAuthData = getMockAuthData(
      organizationId1,
      generateId<UserId>(),
      [userRole.SECURITY_ROLE]
    );
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

  it.each(getContextsAllowedToSeeDraftVersions(generateId()))(
    "should not include eservice templates whose only version is draft (requester is not the creator, user roles: $authData.userRoles, system role: $authData.systemRole))",
    async (context) => {
      const eserviceTemplateVersion6: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        state: eserviceTemplateVersionState.draft,
      };
      const eserviceTemplate6: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        name: "eservice template 006",
        creatorId: organizationId1,
        versions: [eserviceTemplateVersion6],
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
        context
      );
      expect(result.totalCount).toBe(5);
      expect(result.results).toEqual([
        eserviceTemplate1,
        eserviceTemplate2,
        eserviceTemplate3,
        eserviceTemplate4,
        eserviceTemplate5,
      ]);
    }
  );

  it.each(getContextsAllowedToSeeDraftVersions(organizationId1))(
    "should not filter out draft versions if the eservice template has both of draft and published versions (requester is the creator, user roles: $authData.userRoles, system role: $authData.systemRole)",
    async (context) => {
      const eserviceTemplateVersion6a: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        publishedAt: new Date(),
        state: eserviceTemplateVersionState.published,
      };
      const eserviceTemplateVersion6b: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        version: 2,
        state: eserviceTemplateVersionState.draft,
      };
      const eserviceTemplate6: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        name: "eservice template 006",
        creatorId: organizationId1,
        versions: [eserviceTemplateVersion6a, eserviceTemplateVersion6b],
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
        context
      );
      expect(result.totalCount).toBe(6);
      expect(result.results).toEqual(
        [
          eserviceTemplate1,
          eserviceTemplate2,
          eserviceTemplate3,
          eserviceTemplate4,
          eserviceTemplate5,
          eserviceTemplate6,
        ].map((e) => ({
          ...e,
          versions: expect.arrayContaining(e.versions),
        }))
      );
    }
  );

  it("should filter out draft versions if the eservice has both draft and published versions (requester is the creator, but user role is 'security')", async () => {
    const eserviceTemplateVersion6a: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      publishedAt: new Date(),
      state: eserviceTemplateVersionState.published,
    };
    const eserviceTemplateVersion6b: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      version: 2,
      state: eserviceTemplateVersionState.draft,
    };
    const eserviceTemplate6: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name: "eservice template 006",
      creatorId: organizationId1,
      versions: [eserviceTemplateVersion6a, eserviceTemplateVersion6b],
    };

    const authData: UIAuthData = getMockAuthData(
      organizationId1,
      generateId<UserId>(),
      [userRole.SECURITY_ROLE]
    );
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

  it.each(getContextsAllowedToSeeDraftVersions(generateId()))(
    "should filter out draft versions if the eservice template has both of draft and published versions (requester is not the creator, user roles: $authData.userRoles, system role: $authData.systemRole)",
    async (context) => {
      const eserviceTemplateVersion6a: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        interface: getMockDocument(),
        publishedAt: new Date(),
        state: eserviceTemplateVersionState.published,
      };
      const eserviceTemplateVersion6b: EServiceTemplateVersion = {
        ...getMockEServiceTemplateVersion(),
        version: 2,
        state: eserviceTemplateVersionState.draft,
      };
      const eserviceTemplate6: EServiceTemplate = {
        ...getMockEServiceTemplate(),
        name: "eservice template 006",
        creatorId: organizationId1,
        versions: [eserviceTemplateVersion6a, eserviceTemplateVersion6b],
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
        context
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
    }
  );

  it.only.each([undefined, true, false])(
    "should get the eService templates if they exist (parameters: personalData = %s)",
    async (personalData) => {
      const result = await eserviceTemplateService.getEServiceTemplates(
        {
          eserviceTemplatesIds: [],
          creatorsIds: [],
          states: [],
          personalData,
        },
        0,
        50,
        getMockContext({
          authData: getMockAuthData(organizationId3),
        })
      );

      const expectedEServiceTemplates = personalData
        ? [eserviceTemplate1, eserviceTemplate2]
        : [eserviceTemplate3, eserviceTemplate4, eserviceTemplate5];

      expect(result.totalCount).toBe(expectedEServiceTemplates.length);
      expect(result.results).toEqual(
        expect.arrayContaining(
          expectedEServiceTemplates.map((t) => ({
            ...t,
            versions: expect.arrayContaining(t.versions),
          }))
        )
      );
    }
  );
});
