import { getMockAttribute, getMockTenant } from "pagopa-interop-commons-test";
import {
  Attribute,
  ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  PUBLIC_SERVICES_MANAGERS,
  Tenant,
  TenantId,
  attributeKind,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { expect, describe, it, beforeEach, afterEach } from "vitest";

import { config } from "../src/config/config.js";
import {
  ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
  PUBLIC_SERVICES_MANAGERS_TYPOLOGY,
  TenantSeed,
  getTenantUpsertData,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { Institution } from "../src/services/openDataExtractor.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

const economicAccountCompaniesAllowlist: string[] = [];

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

    const upsertData = getTenantUpsertData(
      registryData,
      platformTenant,
      economicAccountCompaniesAllowlist
    );

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

    const upsertData = getTenantUpsertData(
      registryData,
      platformTenant,
      economicAccountCompaniesAllowlist
    );

    expect(upsertData.length).toEqual(platformTenant.length);

    const [gpsTenants, notGpsTenants] = registryData.institutions.reduce<
      [Institution[], Institution[]]
    >(
      (acc, institution) => {
        const isGpsTenant =
          institution.kind === PUBLIC_SERVICES_MANAGERS_TYPOLOGY ||
          (institution.kind === ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY &&
            economicAccountCompaniesAllowlist.includes(institution.originId));

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

    const upsertData = getTenantUpsertData(
      testRegistryData,
      platformTenant,
      economicAccountCompaniesAllowlist
    );

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

    const upsertData = getTenantUpsertData(
      testRegistryData,
      platformTenant,
      economicAccountCompaniesAllowlist
    );

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

  it("should assign the GPS attribute to a normal SCEC when present in allowlist", async () => {
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

    const allowlist = [mockInstitution.originId];
    const upsertData = getTenantUpsertData(
      testRegistryData,
      platformTenant,
      allowlist
    );

    const upsertEntry = findUpsertDataEntryForInstitution(
      upsertData,
      mockInstitution
    );

    expect(upsertEntry?.attributes).toContainEqual({
      origin: mockInstitution.origin,
      code: PUBLIC_SERVICES_MANAGERS,
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

    const upsertData = getTenantUpsertData(
      testRegistryData,
      platformTenant,
      economicAccountCompaniesAllowlist
    );

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

      const upsertData = getTenantUpsertData(
        testRegistryData,
        platformTenant,
        economicAccountCompaniesAllowlist
      );

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

      const upsertData = getTenantUpsertData(
        testRegistryData,
        platformTenant,
        economicAccountCompaniesAllowlist
      );

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

    const upsertData = getTenantUpsertData(
      testRegistryData,
      platformTenant,
      economicAccountCompaniesAllowlist
    );

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
  it("should populate istatCode only if the institution category is L6", async () => {
    const registryData = {
      institutions: [
        {
          id: "tax-code-1",
          originId: "ipa-l6",
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          category: "L6",
          description: "Ente L6",
          kind: "Pubbliche Amministrazioni",
          classification: "Agency" as const,
          istatCode: "123456",
        },
        {
          id: "tax-code-2",
          originId: "ipa-l18",
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          category: "L18",
          description: "Ente L18",
          kind: "Pubbliche Amministrazioni",
          classification: "Agency" as const,
          istatCode: "654321",
        },
      ],
      attributes: [],
    };

    const platformTenants: Tenant[] = [
      {
        id: unsafeBrandId<TenantId>("1"),
        externalId: {
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          value: "ipa-l6",
        },
        features: [],
        attributes: [],
        createdAt: new Date(),
        mails: [],
        name: "ipa-l6",
      },
      {
        id: unsafeBrandId<TenantId>("1"),
        externalId: {
          origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
          value: "ipa-l18",
        },
        features: [],
        attributes: [],
        createdAt: new Date(),
        mails: [],
        name: "ipa-l18",
      },
    ];

    const economicAccountCompaniesAllowlist: string[] = [];

    const tenantSeeds = getTenantUpsertData(
      registryData,
      platformTenants,
      economicAccountCompaniesAllowlist
    );

    const l6Seed = tenantSeeds.find((seed) => seed.originId === "ipa-l6");
    expect(l6Seed).toBeDefined();
    expect(l6Seed?.istatCode).toBe("123456");

    const l18Seed = tenantSeeds.find((seed) => seed.originId === "ipa-l18");
    expect(l18Seed).toBeDefined();
    expect(l18Seed?.istatCode).toBeUndefined();
  });

  describe("subunit attributes", () => {
    const entityIpaCode = "Z1234ABC";
    const aooInstitution = aoo[0];
    const uoInstitution: Institution = {
      ...uo[0],
      subUnit: uo[0].subUnit && {
        ...uo[0].subUnit,
        aooCode: aooInstitution.originId,
      },
    };

    const getEntityAttribute = (
      subunitPropagationEnabled?: boolean,
      code = entityIpaCode
    ): Attribute => ({
      ...getMockAttribute(attributeKind.certified),
      origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
      code,
      subunitPropagationEnabled,
    });

    const getSubUnitSeedCodes = (
      platformAttributes: Attribute[],
      subUnits: Institution[] = [aooInstitution, uoInstitution]
    ): string[][] => {
      const platformTenants: Tenant[] = subUnits.map((i) => ({
        ...getMockTenant(),
        externalId: { origin: i.origin, value: i.originId },
      }));

      const upsertData = getTenantUpsertData(
        { institutions: subUnits, attributes },
        platformTenants,
        economicAccountCompaniesAllowlist,
        platformAttributes
      );

      return subUnits.map(
        (i) =>
          findUpsertDataEntryForInstitution(upsertData, i)?.attributes.map(
            (a) => a.code
          ) ?? []
      );
    };

    beforeEach(() => {
      config.featureFlagAooUoAttributes = true;
    });

    afterEach(() => {
      config.featureFlagAooUoAttributes = false;
    });

    it("should assign the entity attribute and the subunit attribute if the propagation is enabled", () => {
      const [aooCodes, uoCodes] = getSubUnitSeedCodes([
        getEntityAttribute(true),
      ]);

      expect(aooCodes).toEqual(
        expect.arrayContaining([entityIpaCode, aooInstitution.originId])
      );
      expect(uoCodes).toEqual(
        expect.arrayContaining([entityIpaCode, uoInstitution.originId])
      );
    });

    it.each([false, undefined])(
      "should assign only the subunit attribute if the propagation is %s",
      (subunitPropagationEnabled) => {
        const [aooCodes, uoCodes] = getSubUnitSeedCodes([
          getEntityAttribute(subunitPropagationEnabled),
        ]);

        expect(aooCodes).not.toContain(entityIpaCode);
        expect(aooCodes).toContain(aooInstitution.originId);
        expect(uoCodes).not.toContain(entityIpaCode);
        expect(uoCodes).toContain(uoInstitution.originId);
      }
    );

    it("should not assign the entity attribute nor the subunit attribute if the feature flag is disabled", () => {
      config.featureFlagAooUoAttributes = false;

      const [aooCodes, uoCodes] = getSubUnitSeedCodes([
        getEntityAttribute(true),
      ]);

      expect(aooCodes).toEqual([aooInstitution.category]);
      expect(uoCodes).toEqual([uoInstitution.category]);
    });

    it("should follow the new entity attribute when the affiliation of a subunit changes", () => {
      const newEntityIpaCode = "Z9999NEW";
      const movedAoo: Institution = {
        ...aooInstitution,
        subUnit: aooInstitution.subUnit && {
          ...aooInstitution.subUnit,
          entityIpaCode: newEntityIpaCode,
        },
      };

      const [aooCodes] = getSubUnitSeedCodes(
        [getEntityAttribute(true), getEntityAttribute(true, newEntityIpaCode)],
        [movedAoo]
      );

      expect(aooCodes).toContain(newEntityIpaCode);
      expect(aooCodes).not.toContain(entityIpaCode);
    });

    it("should not assign any attribute to a SCEC subunit", () => {
      const scecAoo: Institution = {
        ...aooInstitution,
        category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
      };

      const [aooCodes] = getSubUnitSeedCodes(
        [getEntityAttribute(true)],
        [scecAoo]
      );

      expect(aooCodes).toEqual([]);
    });

    it("should not assign the entity attribute if it is suspended, even if the propagation is enabled", () => {
      const entityAttribute = getEntityAttribute(true);

      const platformTenants: Tenant[] = [
        {
          ...getMockTenant(),
          externalId: {
            origin: aooInstitution.origin,
            value: aooInstitution.originId,
          },
        },
      ];

      const upsertData = getTenantUpsertData(
        { institutions: [aooInstitution], attributes },
        platformTenants,
        economicAccountCompaniesAllowlist,
        [entityAttribute],
        new Set([entityAttribute.id])
      );

      expect(upsertData[0].attributes.map((a) => a.code)).not.toContain(
        entityIpaCode
      );
    });

    it("should assign the attributes even if the entity is not onboarded in the platform", () => {
      const platformTenants: Tenant[] = [
        {
          ...getMockTenant(),
          externalId: {
            origin: aooInstitution.origin,
            value: aooInstitution.originId,
          },
        },
      ];

      const upsertData = getTenantUpsertData(
        { institutions: [aooInstitution], attributes },
        platformTenants,
        economicAccountCompaniesAllowlist,
        [getEntityAttribute(true)]
      );

      expect(
        platformTenants.some((t) => t.externalId.value === entityIpaCode)
      ).toBe(false);
      expect(upsertData[0].attributes.map((a) => a.code)).toEqual(
        expect.arrayContaining([entityIpaCode, aooInstitution.originId])
      );
    });
  });
});
