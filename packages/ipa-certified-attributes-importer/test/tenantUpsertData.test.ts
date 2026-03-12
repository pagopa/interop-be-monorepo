import { expect, describe, it } from "vitest";
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
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

  it("should assign the GPS attribute to an SCEC with S01G category", async () => {
    const mockInstitution: Institution = {
      id: "mockId",
      origin: "IPA",
      originId: "test-SCEC-S01G",
      description: "Test SCEC with S01G category",
      kind: ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
      classification: "Agency",
      category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
    };

    const platformTenant: Tenant[] = [
      {
        id: generateId<TenantId>(),
        selfcareId: mockInstitution.description,
        externalId: {
          origin: mockInstitution.origin,
          value: mockInstitution.originId,
        },
        features: [],
        attributes: [],
        createdAt: new Date(),
        mails: [],
        name: mockInstitution.description,
      },
    ];

    const testRegistryData = {
      institutions: [...registryData.institutions, mockInstitution],
      attributes: registryData.attributes,
    };

    const upsertData = getTenantUpsertData(testRegistryData, platformTenant);

    const upsertEntry = findUpsertDataEntryForInstitution(
      upsertData,
      mockInstitution
    );

    expect(upsertEntry?.attributes).toContainEqual({
      origin: mockInstitution.origin,
      code: PUBLIC_SERVICES_MANAGERS,
    });

    // It should also have the SCEC kind attribute
    expect(upsertEntry?.attributes).toContainEqual({
      origin: mockInstitution.origin,
      code: expect.any(String),
    });
  });

  // Test for a normal SCEC (not on allowlist and not S01G)
  it("should not assign the GPS attribute to a normal SCEC", async () => {
    const mockInstitution: Institution = {
      id: "mockId2",
      origin: "IPA",
      originId: "test-normal-SCEC",
      description: "Test normal SCEC",
      kind: ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
      classification: "Agency",
      category: "S01",
    };

    const platformTenant: Tenant[] = [
      {
        id: generateId<TenantId>(),
        selfcareId: mockInstitution.description,
        externalId: {
          origin: mockInstitution.origin,
          value: mockInstitution.originId,
        },
        features: [],
        attributes: [],
        createdAt: new Date(),
        mails: [],
        name: mockInstitution.description,
      },
    ];

    const testRegistryData = {
      institutions: [...registryData.institutions, mockInstitution],
      attributes: registryData.attributes,
    };

    const upsertData = getTenantUpsertData(testRegistryData, platformTenant);

    const upsertEntry = findUpsertDataEntryForInstitution(
      upsertData,
      mockInstitution
    );

    expect(
      upsertEntry?.attributes.find((a) => a.code === PUBLIC_SERVICES_MANAGERS)
    ).toBeUndefined();

    expect(upsertEntry?.attributes).toContainEqual({
      origin: mockInstitution.origin,
      code: expect.any(String),
    });
  });
  it("should assign only the name attribute (no category) to a GPS SCEC (Agency)", async () => {
    const mockInstitution: Institution = {
      id: "mockId2",
      origin: "IPA",
      originId: "test-normal-SCEC",
      description: "Test normal SCEC",
      kind: ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
      classification: "Agency",
      category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
    };

    const platformTenant: Tenant[] = [
      {
        id: generateId<TenantId>(),
        selfcareId: mockInstitution.description,
        externalId: {
          origin: mockInstitution.origin,
          value: mockInstitution.originId,
        },
        features: [],
        attributes: [],
        createdAt: new Date(),
        mails: [],
        name: mockInstitution.description,
      },
    ];

    const testRegistryData = {
      institutions: [...registryData.institutions, mockInstitution],
      attributes: registryData.attributes,
    };

    const upsertData = getTenantUpsertData(testRegistryData, platformTenant);

    const upsertEntry = findUpsertDataEntryForInstitution(
      upsertData,
      mockInstitution
    );

    expect(
      upsertEntry?.attributes.find((a) => a.code === mockInstitution.originId)
    ).toBeDefined();
    expect(
      upsertEntry?.attributes.find(
        (a) =>
          a.code === mockInstitution.category &&
          a.origin === mockInstitution.origin
      )
    ).toBeUndefined();
  });
  it.each(["AOO", "UO"] as const)(
    "should assign neither name attribute nor category to a GPS SCEC (%s)",
    async (classification) => {
      const mockInstitution: Institution = {
        id: "mockId2",
        origin: "IPA",
        originId: "test-normal-SCEC",
        description: "Test normal SCEC",
        kind: ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
        classification,
        category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
      };

      const platformTenant: Tenant[] = [
        {
          id: generateId<TenantId>(),
          selfcareId: mockInstitution.description,
          externalId: {
            origin: mockInstitution.origin,
            value: mockInstitution.originId,
          },
          features: [],
          attributes: [],
          createdAt: new Date(),
          mails: [],
          name: mockInstitution.description,
        },
      ];

      const testRegistryData = {
        institutions: [...registryData.institutions, mockInstitution],
        attributes: registryData.attributes,
      };

      const upsertData = getTenantUpsertData(testRegistryData, platformTenant);

      const upsertEntry = findUpsertDataEntryForInstitution(
        upsertData,
        mockInstitution
      );

      expect(
        upsertEntry?.attributes.find((a) => a.code === mockInstitution.originId)
      ).toBeUndefined();
      expect(
        upsertEntry?.attributes.find(
          (a) =>
            a.code === mockInstitution.category &&
            a.origin === mockInstitution.origin
        )
      ).toBeUndefined();
    }
  );
  it.each(["AOO", "UO"] as const)(
    "should assign only category attribute an %s",
    async (classification) => {
      const mockInstitution: Institution = {
        id: "mockId2",
        origin: "IPA",
        originId: "test",
        description: "Test",
        kind: "Test Kind",
        classification,
        category: "Test Category",
      };

      const platformTenant: Tenant[] = [
        {
          id: generateId<TenantId>(),
          selfcareId: mockInstitution.description,
          externalId: {
            origin: mockInstitution.origin,
            value: mockInstitution.originId,
          },
          features: [],
          attributes: [],
          createdAt: new Date(),
          mails: [],
          name: mockInstitution.description,
        },
      ];

      const testRegistryData = {
        institutions: [...registryData.institutions, mockInstitution],
        attributes: registryData.attributes,
      };

      const upsertData = getTenantUpsertData(testRegistryData, platformTenant);

      const upsertEntry = findUpsertDataEntryForInstitution(
        upsertData,
        mockInstitution
      );

      expect(
        upsertEntry?.attributes.find((a) => a.code === mockInstitution.originId)
      ).toBeUndefined();
      expect(
        upsertEntry?.attributes.find(
          (a) =>
            a.code === mockInstitution.category &&
            a.origin === mockInstitution.origin
        )
      ).toBeDefined();
    }
  );
  it("should assign both name attribute and category attribute to Agency no SCEC", async () => {
    const mockInstitution: Institution = {
      id: "mockId2",
      origin: "IPA",
      originId: "test-normal",
      description: "Test normal",
      kind: "Test Kind",
      classification: "Agency",
      category: "Test Category",
    };

    const platformTenant: Tenant[] = [
      {
        id: generateId<TenantId>(),
        selfcareId: mockInstitution.description,
        externalId: {
          origin: mockInstitution.origin,
          value: mockInstitution.originId,
        },
        features: [],
        attributes: [],
        createdAt: new Date(),
        mails: [],
        name: mockInstitution.description,
      },
    ];

    const testRegistryData = {
      institutions: [...registryData.institutions, mockInstitution],
      attributes: registryData.attributes,
    };

    const upsertData = getTenantUpsertData(testRegistryData, platformTenant);

    const upsertEntry = findUpsertDataEntryForInstitution(
      upsertData,
      mockInstitution
    );

    expect(
      upsertEntry?.attributes.find((a) => a.code === mockInstitution.originId)
    ).toBeDefined();
    expect(
      upsertEntry?.attributes.find(
        (a) =>
          a.code === mockInstitution.category &&
          a.origin === mockInstitution.origin
      )
    ).toBeDefined();
  });
});
