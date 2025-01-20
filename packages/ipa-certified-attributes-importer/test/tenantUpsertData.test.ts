/* eslint-disable no-console */
import { expect, describe, it } from "vitest";
import { getMockTenant } from "pagopa-interop-commons-test/index.js";
import { Tenant, TenantId, generateId } from "pagopa-interop-models";
import { getTenantUpsertData } from "../src/index.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

const registryData = {
  institutions: [...agency, ...aoo, ...uo],
  attributes,
};

describe("TenantUpsertData", async () => {
  it("should return an empty list if there isn't any matching tenant in the platform", async () => {
    const platformTenant: Tenant[] = [getMockTenant(), getMockTenant()];

    const upsertData = getTenantUpsertData(registryData, platformTenant);

    expect(upsertData).toEqual([]);
  });

  it("generate the correct list of tenant with their attribute from the openData", async () => {
    const platformTenant: Tenant[] = registryData.institutions.map((i) => ({
      id: generateId<TenantId>(),
      selfcareId: i.description,
      externalId: { origin: i.origin, value: i.originId },
      features: [],
      attributes: [],
      createdAt: new Date(),
      mails: [],
      name: i.description,
    }));

    const upsertData = getTenantUpsertData(registryData, platformTenant);

    expect(upsertData.length).toEqual(platformTenant.length);
  });
});
