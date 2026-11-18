/* eslint-disable functional/no-let */
import {
  getMockTenant,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockContext,
} from "pagopa-interop-commons-test";
import {
  EServiceTemplate,
  eserviceTemplateVersionState,
  Tenant,
  TenantId,
  CompactOrganization,
  generateId,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";

import {
  addOneEServiceTemplate,
  addOneTenant,
  eserviceTemplateService,
} from "../integrationUtils.js";

describe("getEServiceTemplateCreators", () => {
  const rootTenant: Tenant = {
    ...getMockTenant(),
    name: "Tenant root",
    subUnitType: undefined,
  };
  const parentTenant: Tenant = {
    ...getMockTenant(),
    name: "Tenant AOO",
    subUnitType: "AOO",
    parentTenantId: rootTenant.id,
    rootTenantId: rootTenant.id,
  };
  let tenant1: Tenant;
  let tenant2: Tenant;
  let tenant3: Tenant;
  let tenant4: Tenant;
  let tenant5: Tenant;
  let tenant6: Tenant;

  const toCompactOrganization = (tenant: Tenant): CompactOrganization => ({
    id: tenant.id,
    name: tenant.name,
    ...(tenant.id === tenant3.id
      ? {
          subUnitType: tenant3.subUnitType,
          parentTenants: [
            {
              id: parentTenant.id,
              name: parentTenant.name,
              subUnitType: parentTenant.subUnitType,
            },
            { id: rootTenant.id, name: rootTenant.name },
          ],
        }
      : {}),
  });

  beforeEach(async () => {
    tenant1 = { ...getMockTenant(), name: "Tenant 1 Foo" };
    tenant2 = { ...getMockTenant(), name: "Tenant 2 Bar" };
    tenant3 = {
      ...getMockTenant(),
      name: "Tenant 3 FooBar",
      subUnitType: "UO",
      parentTenantId: parentTenant.id,
      rootTenantId: rootTenant.id,
    };
    tenant4 = { ...getMockTenant(), name: "Tenant 4 Baz" };
    tenant5 = { ...getMockTenant(), name: "Tenant 5 BazBar" };
    tenant6 = { ...getMockTenant(), name: "Tenant 6 BazFoo" };

    await addOneTenant(rootTenant);
    await addOneTenant(parentTenant);
    await addOneTenant(tenant1);
    await addOneTenant(tenant2);
    await addOneTenant(tenant3);
    await addOneTenant(tenant4);
    await addOneTenant(tenant5);
    await addOneTenant(tenant6);

    const eserviceTemplate1: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
      creatorId: tenant2.id,
    };

    const eserviceTemplate2: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
      creatorId: tenant3.id,
    };

    const eserviceTemplate3: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
      creatorId: tenant4.id,
    };

    const eserviceTemplate4: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
      creatorId: tenant5.id,
    };

    const eserviceTemplate5: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
      creatorId: tenant6.id,
    };

    await addOneEServiceTemplate(eserviceTemplate1);
    await addOneEServiceTemplate(eserviceTemplate2);
    await addOneEServiceTemplate({
      ...getMockEServiceTemplate(),
      creatorId: tenant3.id,
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
    });
    await addOneEServiceTemplate(eserviceTemplate3);
    await addOneEServiceTemplate(eserviceTemplate4);
    await addOneEServiceTemplate(eserviceTemplate5);
  });

  it("should get all eservice template creators", async () => {
    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      undefined,
      10,
      0,
      getMockContext({})
    );

    expect(creators).toEqual({
      totalCount: 5,
      results: expect.arrayContaining(
        [tenant2, tenant3, tenant4, tenant5, tenant6].map(toCompactOrganization)
      ),
    });
  });
  it("should not return creators with no published e-service template versions", async () => {
    const tenant7 = { ...getMockTenant(), name: "Tenant 7" };

    const eserviceTemplate6: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.draft,
        },
      ],
      creatorId: tenant7.id,
    };

    const eserviceTemplate7: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.deprecated,
        },
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.suspended,
        },
      ],
      creatorId: tenant7.id,
    };

    await addOneEServiceTemplate(eserviceTemplate6);
    await addOneEServiceTemplate(eserviceTemplate7);

    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      undefined,
      10,
      0,
      getMockContext({})
    );

    expect(creators).toEqual({
      totalCount: 5,
      results: expect.arrayContaining(
        [tenant2, tenant3, tenant4, tenant5, tenant6].map(toCompactOrganization)
      ),
    });
  });
  it("should get eservice template creators filtered by name", async () => {
    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      "Foo",
      10,
      0,
      getMockContext({})
    );

    expect(creators).toEqual({
      totalCount: 2,
      results: expect.arrayContaining(
        [tenant3, tenant6].map(toCompactOrganization)
      ),
    });
  });
  it("should get eservice template creators with limit", async () => {
    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      undefined,
      2,
      0,
      getMockContext({})
    );

    expect(creators).toEqual({
      totalCount: 5,
      results: expect.arrayContaining(
        [tenant2, tenant3].map(toCompactOrganization)
      ),
    });
  });
  it("should get eservice template creators with offset and limit", async () => {
    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      undefined,
      2,
      1,
      getMockContext({})
    );

    expect(creators).toEqual({
      totalCount: 5,
      results: expect.arrayContaining(
        [tenant3, tenant4].map(toCompactOrganization)
      ),
    });
  });
  it("should get eservice template creators with offset, limit, and name filter", async () => {
    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      "Foo",
      1,
      1,
      getMockContext({})
    );

    expect(creators).toEqual({
      totalCount: 2,
      results: expect.arrayContaining([tenant6].map(toCompactOrganization)),
    });
  });
  it("should get no eservice template creators in case no filters match", async () => {
    const producers = await eserviceTemplateService.getEServiceTemplateCreators(
      "Not existing name",
      10,
      0,
      getMockContext({})
    );

    expect(producers).toEqual({
      totalCount: 0,
      results: [],
    });
  });

  it.each([
    "Tenant AOO",
    "Tenant root",
    "Tenant 3 FooBar - Tenant AOO - Tenant root",
  ])("should filter creators by hierarchical name %s", async (name) => {
    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      name,
      10,
      0,
      getMockContext({})
    );

    expect(creators.totalCount).toBe(1);
    expect(creators.results).toEqual([toCompactOrganization(tenant3)]);
  });

  it("should return a direct root only once", async () => {
    await addOneEServiceTemplate({
      ...getMockEServiceTemplate(),
      creatorId: parentTenant.id,
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
    });

    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      "Tenant AOO - Tenant root",
      10,
      0,
      getMockContext({})
    );

    expect(
      creators.results.find((creator) => creator.id === parentTenant.id)
    ).toEqual({
      id: parentTenant.id,
      name: parentTenant.name,
      subUnitType: "AOO",
      parentTenants: [{ id: rootTenant.id, name: rootTenant.name }],
    });
    const duplicatedRoot =
      await eserviceTemplateService.getEServiceTemplateCreators(
        "Tenant root - Tenant root",
        10,
        0,
        getMockContext({})
      );
    expect(duplicatedRoot.results).toEqual([]);
  });

  it("should preserve creators whose parent cannot be resolved", async () => {
    await addOneTenant({
      ...tenant3,
      parentTenantId: generateId<TenantId>(),
    });
    const creators = await eserviceTemplateService.getEServiceTemplateCreators(
      tenant3.name,
      10,
      0,
      getMockContext({})
    );

    expect(creators.results).toEqual([
      {
        id: tenant3.id,
        name: tenant3.name,
        subUnitType: "UO",
        parentTenants: undefined,
      },
    ]);
  });
});
