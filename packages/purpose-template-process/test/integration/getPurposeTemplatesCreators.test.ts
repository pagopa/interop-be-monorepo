import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  getMockPurposeTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  purposeTemplateState,
  Tenant,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addOnePurposeTemplate,
  addOneTenant,
  readModelService,
} from "../integrationUtils.js";

describe("getPublishedPurposeTemplateCreators", () => {
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
  const tenant1: Tenant = {
    ...getMockTenant(),
    name: "Tenant 1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    name: "Tenant 2",
    subUnitType: "UO",
    parentTenantId: parentTenant.id,
    rootTenantId: rootTenant.id,
  };
  const tenant3: Tenant = {
    ...getMockTenant(),
    name: "Tenant 3",
  };

  const toCompactOrganization = (
    tenant: Tenant
  ): purposeTemplateApi.CompactOrganization => ({
    id: tenant.id,
    name: tenant.name,
    ...(tenant.id === tenant2.id
      ? {
          subUnitType: tenant2.subUnitType,
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

  const mockTenant1 = toCompactOrganization(tenant1);
  const mockTenant2 = toCompactOrganization(tenant2);
  const mockTenant3 = toCompactOrganization(tenant3);

  beforeEach(async () => {
    await addOneTenant(rootTenant);
    await addOneTenant(parentTenant);
  });

  it("should get creators", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    await addOneTenant(tenant3);

    const purposeTemplate3: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant3.id,
    };
    await addOnePurposeTemplate(purposeTemplate3);

    const creators = await readModelService.getPublishedPurposeTemplateCreators(
      {
        creatorName: undefined,
        offset: 0,
        limit: 50,
      }
    );
    expect(creators.totalCount).toBe(3);
    expect(creators.results).toEqual([mockTenant1, mockTenant2, mockTenant3]);
  });
  it("should get creators by name", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    const creators = await readModelService.getPublishedPurposeTemplateCreators(
      {
        creatorName: "1",
        offset: 0,
        limit: 50,
      }
    );
    expect(creators.totalCount).toBe(1);
    expect(creators.results).toEqual([mockTenant1]);
  });
  it("should not get any tenants if no one matches the requested name", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    const creators = await readModelService.getPublishedPurposeTemplateCreators(
      {
        creatorName: "Tenant 6",
        offset: 0,
        limit: 50,
      }
    );
    expect(creators.totalCount).toBe(0);
    expect(creators.results).toEqual([]);
  });
  it("should not get creators if their tenants are not in DB", async () => {
    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    const creators = await readModelService.getPublishedPurposeTemplateCreators(
      {
        creatorName: undefined,
        offset: 0,
        limit: 50,
      }
    );
    expect(creators.totalCount).toBe(0);
    expect(creators.results).toEqual([]);
  });
  it("should get creators (pagination: limit)", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    await addOneTenant(tenant3);

    const purposeTemplate3: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant3.id,
    };
    await addOnePurposeTemplate(purposeTemplate3);
    const tenantsByName =
      await readModelService.getPublishedPurposeTemplateCreators({
        creatorName: undefined,
        offset: 0,
        limit: 2,
      });
    expect(tenantsByName.results.length).toBe(2);
  });
  it("should get creators (pagination: offset, limit)", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    await addOneTenant(tenant3);

    const purposeTemplate3: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant3.id,
    };
    await addOnePurposeTemplate(purposeTemplate3);
    await addOnePurposeTemplate({
      ...getMockPurposeTemplate(),
      creatorId: tenant2.id,
      state: purposeTemplateState.published,
    });
    const tenantsByName =
      await readModelService.getPublishedPurposeTemplateCreators({
        creatorName: undefined,
        offset: 1,
        limit: 1,
      });
    expect(tenantsByName.results.length).toBe(1);
    expect(tenantsByName.results).toEqual([mockTenant2]);
    expect(tenantsByName.totalCount).toBe(3);
  });
  it("should not get creators for purpose templates not published", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.draft,
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    await addOneTenant(tenant3);

    const purposeTemplate3: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      state: purposeTemplateState.published,
      creatorId: tenant3.id,
    };
    await addOnePurposeTemplate(purposeTemplate3);
    const tenantsByName =
      await readModelService.getPublishedPurposeTemplateCreators({
        creatorName: undefined,
        offset: 0,
        limit: 10,
      });
    expect(tenantsByName.results.length).toBe(2);
    expect(tenantsByName.results).toEqual([mockTenant2, mockTenant3]);
  });

  it.each(["Tenant AOO", "Tenant root", "Tenant 2 - Tenant AOO - Tenant root"])(
    "should filter creators by hierarchical name %s",
    async (creatorName) => {
      await addOneTenant(tenant2);
      await addOnePurposeTemplate({
        ...getMockPurposeTemplate(),
        creatorId: tenant2.id,
        state: purposeTemplateState.published,
      });
      await addOnePurposeTemplate({
        ...getMockPurposeTemplate(),
        creatorId: parentTenant.id,
        state: purposeTemplateState.draft,
      });
      const creators =
        await readModelService.getPublishedPurposeTemplateCreators({
          creatorName,
          offset: 0,
          limit: 10,
        });
      expect(creators).toEqual({ totalCount: 1, results: [mockTenant2] });
    }
  );

  it("should return a direct root only once", async () => {
    await addOnePurposeTemplate({
      ...getMockPurposeTemplate(),
      creatorId: parentTenant.id,
      state: purposeTemplateState.published,
    });
    const creators = await readModelService.getPublishedPurposeTemplateCreators(
      {
        creatorName: "Tenant AOO - Tenant root",
        offset: 0,
        limit: 10,
      }
    );
    expect(creators.results).toEqual([
      {
        id: parentTenant.id,
        name: parentTenant.name,
        subUnitType: "AOO",
        parentTenants: [{ id: rootTenant.id, name: rootTenant.name }],
      },
    ]);
    const duplicatedRoot =
      await readModelService.getPublishedPurposeTemplateCreators({
        creatorName: "Tenant root - Tenant root",
        offset: 0,
        limit: 10,
      });
    expect(duplicatedRoot.results).toEqual([]);
  });

  it("should preserve creators whose parent cannot be resolved", async () => {
    await addOneTenant({ ...tenant2, parentTenantId: generateId<TenantId>() });
    await addOnePurposeTemplate({
      ...getMockPurposeTemplate(),
      creatorId: tenant2.id,
      state: purposeTemplateState.published,
    });
    const creators = await readModelService.getPublishedPurposeTemplateCreators(
      {
        creatorName: tenant2.name,
        offset: 0,
        limit: 10,
      }
    );
    expect(creators.results).toEqual([
      {
        id: tenant2.id,
        name: tenant2.name,
        subUnitType: "UO",
        parentTenants: undefined,
      },
    ]);
  });
});
