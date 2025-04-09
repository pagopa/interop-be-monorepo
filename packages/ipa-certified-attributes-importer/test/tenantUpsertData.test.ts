import { expect, describe, it } from "vitest";
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  PUBLIC_SERVICES_MANAGERS,
  Tenant,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import {
  ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
  PUBLIC_SERVICES_MANAGERS_TYPOLOGY,
  TenantSeed,
  getTenantUpsertData,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { Institution } from "../src/services/openDataExtractor.js";
import { config } from "../src/config/config.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

const registryData = {
  institutions: [...agency, ...aoo, ...uo],
  attributes,
};

function findUpsertDataEntryForInstitution(
  upsertData: TenantSeed[],
  institution: (typeof registryData.institutions)[0]
): TenantSeed | undefined {
  return upsertData.find(
    (d) =>
      d.origin === institution.origin &&
      d.originId === institution.originId &&
      d.description === institution.description
  );
}

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

    const [gpsTenants, notGpsTenants] = registryData.institutions.reduce<
      [Institution[], Institution[]]
    >(
      (acc, institution) => {
        const isGpsTenant =
          institution.kind === PUBLIC_SERVICES_MANAGERS_TYPOLOGY ||
          (institution.kind === ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY &&
            config.economicAccountCompaniesAllowlist.includes(
              institution.originId
            ));

        if (isGpsTenant) {
          // eslint-disable-next-line functional/immutable-data
          acc[0].push(institution);
        } else {
          // eslint-disable-next-line functional/immutable-data
          acc[1].push(institution);
        }

        return acc;
      },
      [[], []]
    );

    expect(gpsTenants.length).toBeGreaterThan(0);

    gpsTenants.forEach((i) => {
      const upsertEntry = findUpsertDataEntryForInstitution(upsertData, i);

      expect(upsertEntry?.attributes).toContainEqual({
        origin: i.origin,
        code: PUBLIC_SERVICES_MANAGERS,
      });
    });

    // In the env 1VO9PWVQ is not present in ECONOMIC_ACCOUNT_COMPANIES_ALLOWLIST
    expect(gpsTenants).not.toContainEqual({ originId: "1VO9PWVQ" });

    expect(notGpsTenants.length).toBeGreaterThan(0);

    notGpsTenants.forEach((i) => {
      const upsertEntry = findUpsertDataEntryForInstitution(upsertData, i);

      expect(
        upsertEntry?.attributes.find((a) => a.code === PUBLIC_SERVICES_MANAGERS)
      )?.toBeUndefined();
    });
  });
});
