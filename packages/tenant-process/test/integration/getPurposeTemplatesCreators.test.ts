import { describe, expect, it } from "vitest";
import { PurposeTemplate, Tenant } from "pagopa-interop-models";
import {
  getMockPurposeTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  addOnePurposeTemplate,
  addOneTenant,
  readModelService,
} from "../integrationUtils.js";

describe("getPurposeTemplatesCreators", () => {
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
  it("should get creators", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    await addOneTenant(tenant3);

    const purposeTemplate3: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant3.id,
    };
    await addOnePurposeTemplate(purposeTemplate3);

    const creators = await readModelService.getPurposeTemplatesCreators({
      creatorName: undefined,
      offset: 0,
      limit: 50,
    });
    expect(creators.totalCount).toBe(3);
    expect(creators.results).toEqual([tenant1, tenant2, tenant3]);
  });
  it("should get creators by name", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    const creators = await readModelService.getPurposeTemplatesCreators({
      creatorName: "1",
      offset: 0,
      limit: 50,
    });
    expect(creators.totalCount).toBe(1);
    expect(creators.results).toEqual([tenant1]);
  });
  it("should not get any tenants if no one matches the requested name", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    const creators = await readModelService.getPurposeTemplatesCreators({
      creatorName: "Tenant 6",
      offset: 0,
      limit: 50,
    });
    expect(creators.totalCount).toBe(0);
    expect(creators.results).toEqual([]);
  });
  it("should not get any tenants if no one is in DB", async () => {
    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    const creators = await readModelService.getPurposeTemplatesCreators({
      creatorName: "A tenant",
      offset: 0,
      limit: 50,
    });
    expect(creators.totalCount).toBe(0);
    expect(creators.results).toEqual([]);
  });
  it("should get creators (pagination: limit)", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    await addOneTenant(tenant3);

    const purposeTemplate3: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant3.id,
    };
    await addOnePurposeTemplate(purposeTemplate3);
    const tenantsByName = await readModelService.getPurposeTemplatesCreators({
      creatorName: undefined,
      offset: 0,
      limit: 3,
    });
    expect(tenantsByName.results.length).toBe(3);
  });
  it("should get producers (pagination: offset, limit)", async () => {
    await addOneTenant(tenant1);

    const purposeTemplate1: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant1.id,
    };
    await addOnePurposeTemplate(purposeTemplate1);

    await addOneTenant(tenant2);

    const purposeTemplate2: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant2.id,
    };
    await addOnePurposeTemplate(purposeTemplate2);

    await addOneTenant(tenant3);

    const purposeTemplate3: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      creatorId: tenant3.id,
    };
    await addOnePurposeTemplate(purposeTemplate3);
    const tenantsByName = await readModelService.getPurposeTemplatesCreators({
      creatorName: undefined,
      offset: 2,
      limit: 3,
    });
    expect(tenantsByName.results.length).toBe(1);
  });
});
