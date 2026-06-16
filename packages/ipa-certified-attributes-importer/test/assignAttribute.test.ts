/* eslint-disable sonarjs/no-identical-functions */
import { randomUUID } from "crypto";
import {
  Attribute,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  unsafeBrandId,
} from "pagopa-interop-models";
import { expect, describe, it, vi, beforeAll, afterAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  TenantSeed,
  getAttributesToAssign,
  getTenantUpsertData,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { attributes } from "./expectation.js";
import { parseIPACertifiedAttributesImporterConfig } from "../src/config/config.js";

describe("GetAttributesToAssign", async () => {
  const mockedDate = new Date("2024-01-01T00:00:00.000Z");
  const config = parseIPACertifiedAttributesImporterConfig(process.env);
  const enabledConfig = {
    ...config,
    featureFlagAttributeCertifiedDiscrete: true,
  };
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockedDate);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("assign attribute only to tenant already present in the platform", async () => {
    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: "IPA",
            code: attributes[0].code,
          },
          {
            origin: "IPA",
            code: attributes[1].code,
          },
        ],
      },
      {
        origin: "IPA",
        originId: "2",
        description: "tenant2",
        attributes: [
          {
            origin: "IPA",
            code: attributes[2].code,
          },
          {
            origin: "IPA",
            code: attributes[3].code,
          },
        ],
      },
    ];

    const platformAttributes: Attribute[] = attributes.map((a) => ({
      ...a,
      creationTime: new Date(),
      kind: "Certified",
      id: unsafeBrandId(randomUUID()),
    }));

    const ipaTenants: Tenant[] = [
      {
        id: unsafeBrandId("2"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "2" },
        features: [],
        attributes: [],
        createdAt: new Date(),
        mails: [],
        name: "tenant 2",
      },
    ];

    const attributesToAssign = await getAttributesToAssign(
      ipaTenants,
      platformAttributes,
      tenantSeed,
      config,
      genericLogger
    );

    expect(attributesToAssign).toEqual([
      {
        name: "tenant 2",
        certifiedAttributes: [
          { origin: attributes[2].origin, code: attributes[2].code },
          { origin: attributes[3].origin, code: attributes[3].code },
        ],
        externalId: { origin: "IPA", value: "2" },
        remoteIds: undefined,
      },
    ]);
  });

  it("assign attribute only if is not already assigned or if the revocation timestamp is present", async () => {
    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: "IPA",
            code: attributes[0].code,
          },
          {
            origin: "IPA",
            code: attributes[1].code,
          },
        ],
      },
      {
        origin: "IPA",
        originId: "2",
        description: "tenant2",
        attributes: [
          {
            origin: "IPA",
            code: attributes[2].code,
          },
          {
            origin: "IPA",
            code: attributes[3].code,
          },
        ],
      },
    ];

    const platformAttributes: Attribute[] = attributes.map((a) => ({
      ...a,
      creationTime: new Date(),
      kind: "Certified",
      id: unsafeBrandId(randomUUID()),
    }));

    const ipaTenants: Tenant[] = [
      {
        id: unsafeBrandId("1"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "1" },
        features: [],
        attributes: [
          {
            id: platformAttributes[0].id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        mails: [],
        name: "tenant 1",
      },
      {
        id: unsafeBrandId("2"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "2" },
        features: [],
        attributes: [
          {
            id: platformAttributes[2].id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
          },
          {
            id: platformAttributes[3].id,
            type: "PersistentCertifiedAttribute",
            assignmentTimestamp: new Date(),
            revocationTimestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        mails: [],
        name: "tenant 2",
      },
    ];

    const attributesToAssign = await getAttributesToAssign(
      ipaTenants,
      platformAttributes,
      tenantSeed,
      config,
      genericLogger
    );

    expect(attributesToAssign).toEqual([
      {
        name: "tenant 1",
        certifiedAttributes: [
          { origin: attributes[1].origin, code: attributes[1].code },
        ],
        externalId: { origin: "IPA", value: "1" },
        remoteIds: undefined,
      },
      {
        name: "tenant 2",
        certifiedAttributes: [
          { origin: attributes[3].origin, code: attributes[3].code },
        ],
        externalId: { origin: "IPA", value: "2" },
        remoteIds: undefined,
      },
    ]);
  });

  it("should assign remoteId (ISTAT) if present in seed and not in tenant", async () => {
    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [],
        istatCode: "001234",
      },
    ];

    const ipaTenants: Tenant[] = [
      {
        id: unsafeBrandId("1"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "1" },
        features: [],
        attributes: [],
        remoteIds: [],
        createdAt: new Date(),
        mails: [],
        name: "tenant 1",
      },
    ];

    const attributesToAssign = await getAttributesToAssign(
      ipaTenants,
      [],
      tenantSeed,
      enabledConfig,
      genericLogger
    );

    expect(attributesToAssign).toEqual([
      {
        name: "tenant 1",
        certifiedAttributes: [],
        externalId: { origin: "IPA", value: "1" },
        remoteIds: [
          {
            origin: "ISTAT",
            value: "001234",
            assignmentTimestamp: mockedDate.toISOString(),
          },
        ],
      },
    ]);
  });

  it("should NOT assign remoteId (ISTAT) if already present in tenant with same value", async () => {
    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [{ origin: "IPA", code: "NEW-ATTR" }],
        istatCode: "001234",
      },
    ];

    const platformAttributes: Attribute[] = [
      {
        id: unsafeBrandId(randomUUID()),
        name: "NEW-ATTR",
        code: "NEW-ATTR",
        origin: "IPA",
        kind: "Certified",
        description: "",
        creationTime: new Date(),
      },
    ];

    const ipaTenants: Tenant[] = [
      {
        id: unsafeBrandId("1"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "1" },
        features: [],
        attributes: [],
        remoteIds: [
          {
            origin: "ISTAT",
            value: "001234",
            assignmentTimestamp: new Date("2023-01-01T00:00:00.000Z"),
          },
        ],
        createdAt: new Date(),
        mails: [],
        name: "tenant 1",
      },
    ];

    const attributesToAssign = await getAttributesToAssign(
      ipaTenants,
      platformAttributes,
      tenantSeed,
      enabledConfig,
      genericLogger
    );

    expect(attributesToAssign).toEqual([
      {
        name: "tenant 1",
        certifiedAttributes: [{ origin: "IPA", code: "NEW-ATTR" }],
        externalId: { origin: "IPA", value: "1" },
        remoteIds: undefined,
      },
    ]);
  });
  it("should ignore istatCode and NOT assign remoteId if featureFlagAttributeCertifiedDiscrete is OFF", async () => {
    const disabledConfig = {
      ...config,
      featureFlagAttributeCertifiedDiscrete: false,
    };

    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [{ origin: "IPA", code: "NEW-ATTR" }],
        istatCode: "001234",
      },
    ];

    const platformAttributes: Attribute[] = [
      {
        id: unsafeBrandId(randomUUID()),
        name: "NEW-ATTR",
        code: "NEW-ATTR",
        origin: "IPA",
        kind: "Certified",
        description: "",
        creationTime: new Date(),
      },
    ];

    const ipaTenants: Tenant[] = [
      {
        id: unsafeBrandId("1"),
        selfcareId: "fake-selfcare-id",
        externalId: { origin: "IPA", value: "1" },
        features: [],
        attributes: [],
        remoteIds: [],
        createdAt: new Date(),
        mails: [],
        name: "tenant 1",
      },
    ];

    const attributesToAssign = await getAttributesToAssign(
      ipaTenants,
      platformAttributes,
      tenantSeed,
      disabledConfig,
      genericLogger
    );

    expect(attributesToAssign).toEqual([
      {
        name: "tenant 1",
        certifiedAttributes: [{ origin: "IPA", code: "NEW-ATTR" }],
        externalId: { origin: "IPA", value: "1" },
        remoteIds: undefined,
      },
    ]);
  });
  describe("getTenantUpsertData", () => {
    it("should populate istatCode only if the institution category is L6", () => {
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
          id: unsafeBrandId("1"),
          externalId: {
            origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
            value: "ipa-l6",
          },
        } as Tenant,
        {
          id: unsafeBrandId("2"),
          externalId: {
            origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
            value: "ipa-l18",
          },
        } as Tenant,
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
  });
});
