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
  CompactOrganization,
} from "pagopa-interop-models";
import { describe, beforeEach, it, expect } from "vitest";
import {
  addOneEServiceTemplate,
  addOneTenant,
  eserviceTemplateService,
} from "../integrationUtils.js";

describe("getEServiceTemplateCreators", () => {
  let tenant1: Tenant;
  let tenant2: Tenant;
  let tenant3: Tenant;
  let tenant4: Tenant;
  let tenant5: Tenant;
  let tenant6: Tenant;

  const toCompactOrganization = (tenant: Tenant): CompactOrganization => ({
    id: tenant.id,
    name: tenant.name,
  });

  beforeEach(async () => {
    tenant1 = { ...getMockTenant(), name: "Tenant 1 Foo" };
    tenant2 = { ...getMockTenant(), name: "Tenant 2 Bar" };
    tenant3 = { ...getMockTenant(), name: "Tenant 3 FooBar" };
    tenant4 = { ...getMockTenant(), name: "Tenant 4 Baz" };
    tenant5 = { ...getMockTenant(), name: "Tenant 5 BazBar" };
    tenant6 = { ...getMockTenant(), name: "Tenant 6 BazFoo" };

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
});
