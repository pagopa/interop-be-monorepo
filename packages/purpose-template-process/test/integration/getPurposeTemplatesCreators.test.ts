import { describe, expect, it } from "vitest";
import {
  PurposeTemplate,
  purposeTemplateState,
  Tenant,
} from "pagopa-interop-models";
import {
  getMockPurposeTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  addOnePurposeTemplate,
  addOneTenant,
  readModelService,
} from "../integrationUtils.js";

describe("getPublishedPurposeTemplateCreators", () => {
  const tenant1: Tenant = {
    ...getMockTenant(),
    name: "Tenant 1",
  };
  const tenant2: Tenant = {
    ...getMockTenant(),
    name: "Tenant 2",
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
  });

  const mockTenant1 = toCompactOrganization(tenant1);
  const mockTenant2 = toCompactOrganization(tenant2);
  const mockTenant3 = toCompactOrganization(tenant3);

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
  it("should not get any tenants if no one is in DB", async () => {
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
        creatorName: "A tenant",
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
    const tenantsByName =
      await readModelService.getPublishedPurposeTemplateCreators({
        creatorName: undefined,
        offset: 1,
        limit: 1,
      });
    expect(tenantsByName.results.length).toBe(1);
    expect(tenantsByName.results).toEqual([mockTenant2]);
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
});
