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

    const gpsTenants = registryData.institutions.filter(
      (i) => i.kind === "Gestori di Pubblici Servizi"
    );
    expect(gpsTenants.length).toBeGreaterThan(0);

    gpsTenants.forEach((i) => {
      const upsertEntry = upsertData.find(
        (d) =>
          d.origin === i.origin &&
          d.originId === i.originId &&
          d.description === i.description
      );

      expect(upsertEntry).toBeDefined();
      expect(upsertEntry?.attributes.length).toBeGreaterThan(0);
      expect(upsertEntry?.attributes).toContainEqual({
        origin: i.origin,
        code: "L37",
      });
    });

    const notGpsTenants = registryData.institutions.filter(
      (i) => i.kind !== "Gestori di Pubblici Servizi"
    );
    expect(notGpsTenants.length).toBeGreaterThan(0);

    notGpsTenants.forEach((i) => {
      const upsertEntry = upsertData.find(
        (d) =>
          d.origin === i.origin &&
          d.originId === i.originId &&
          d.description === i.description
      );

      expect(upsertEntry).toBeDefined();
      expect(
        upsertEntry?.attributes.find((a) => a.code === "L37")
      )?.toBeUndefined();
    });
  });
});
