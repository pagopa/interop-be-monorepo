import { randomUUID } from "crypto";
import { getMockAttribute } from "pagopa-interop-commons-test";
import { Attribute, unsafeBrandId } from "pagopa-interop-models";
import { expect, describe, it, beforeEach } from "vitest";

import type { Institution } from "../src/services/openDataExtractor.js";

import { config } from "../src/config/config.js";
import {
  TenantSeed,
  getNewAttributes,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

describe("NewAttributes", async () => {
  beforeEach(() => {
    config.featureFlagAooUoAttributes = false;
  });

  it("create only attribute that are not present and that will be assigned to a tenant", async () => {
    const registryData = {
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    };

    const assignedAttributes = attributes.slice(0, 2);

    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: "IPA",
            code: assignedAttributes[0].code,
          },
          {
            origin: "IPA",
            code: assignedAttributes[1].code,
          },
        ],
      },
    ];

    const platformAttributes: Attribute[] = [];

    const newAttributes = getNewAttributes(
      registryData,
      tenantSeed,
      platformAttributes
    );

    expect(newAttributes).toEqual(assignedAttributes);
  });

  it("doesn't create any attribute if already present in the platform", async () => {
    const registryData = {
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    };

    const assignedAttributes = attributes.slice(0, 2);

    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: "IPA",
            code: assignedAttributes[0].code,
          },
          {
            origin: "IPA",
            code: assignedAttributes[1].code,
          },
        ],
      },
    ];

    const platformAttributes: Attribute[] = assignedAttributes.map((a) => ({
      ...a,
      creationTime: new Date(),
      kind: "Certified",
      id: unsafeBrandId(randomUUID()),
    }));

    const newAttributes = getNewAttributes(
      registryData,
      tenantSeed,
      platformAttributes
    );

    expect(newAttributes).toEqual([]);
  });

  it("doesn't create any attribute if are not to assign to any tenant", async () => {
    const registryData = {
      institutions: [...agency, ...aoo, ...uo],
      attributes,
    };

    const tenantSeed: TenantSeed[] = [
      {
        origin: "IPA",
        originId: "1",
        description: "tenant1",
        attributes: [],
      },
    ];

    const platformAttributes: Attribute[] = [];

    const newAttributes = getNewAttributes(
      registryData,
      tenantSeed,
      platformAttributes
    );

    expect(newAttributes).toEqual([]);
  });
  const getMockInstitution = (
    originId: string,
    classification: "AOO" | "UO",
    subUnit: { name: string; entityName: string; aooCode?: string },
    category = "L6"
  ): Institution => ({
    id: `tax-${originId}`,
    originId,
    category,
    description: subUnit.name,
    origin: "IPA",
    kind: "Pubbliche Amministrazioni",
    classification,
    subUnit,
  });

  const aooUoInstitutions = [
    getMockInstitution("A001", "AOO", { name: "AOO One", entityName: "Ente" }),
    getMockInstitution("U001", "UO", {
      name: "UO One",
      entityName: "Ente",
      aooCode: "A001",
    }),
    getMockInstitution("U002", "UO", { name: "UO Two", entityName: "Ente" }),
    getMockInstitution("U003", "UO", { name: "UO Two", entityName: "Ente" }),
    getMockInstitution(
      "U004",
      "UO",
      { name: "UO Scec", entityName: "Ente" },
      "S01G"
    ),
  ];
  const aooUoSeeds: TenantSeed[] = aooUoInstitutions.map((i) => ({
    origin: "IPA",
    originId: i.originId,
    description: i.description,
    attributes: [],
  }));
  const aooUoRegistryData = { institutions: aooUoInstitutions, attributes: [] };

  it("AOO/UO A4: creates seeds only when the flag is enabled", () => {
    expect(getNewAttributes(aooUoRegistryData, aooUoSeeds, [])).toEqual([]);
  });

  it("AOO/UO A4: composes names, handles collisions and excludes SCEC", () => {
    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(aooUoRegistryData, aooUoSeeds, []);
    expect(result.map((a) => [a.code, a.name])).toEqual([
      ["A001", "AOO One di Ente"],
      ["U001", "UO One di AOO One di Ente"],
      ["U002", "UO Two di Ente (U002)"],
      ["U003", "UO Two di Ente (U003)"],
    ]);
  });

  it("AOO/UO A4: is idempotent and suffixes names already in the platform", () => {
    const platform = [
      {
        ...getMockAttribute(),
        origin: "IPA",
        code: "A001",
        name: "x",
      },
      {
        ...getMockAttribute(),
        origin: "IPA",
        code: "Z",
        name: "UO One di AOO One di Ente",
      },
    ];
    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(aooUoRegistryData, aooUoSeeds, platform);
    expect(result.map((a) => a.code)).toEqual(["U001", "U002", "U003"]);
    expect(result[0].name).toBe("UO One di AOO One di Ente (U001)");
  });

  it("AOO/UO A4: compares names case-insensitively and avoids suffixed name collisions", () => {
    const platform = [
      {
        ...getMockAttribute(),
        origin: "IPA",
        code: "Z",
        name: "uo one DI aoo one di ente",
      },
      {
        ...getMockAttribute(),
        origin: "IPA",
        code: "Y",
        name: "UO Two di Ente (U002)",
      },
    ];
    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(
      { institutions: aooUoInstitutions, attributes: [] },
      aooUoSeeds,
      platform
    );
    expect(result.map((a) => [a.code, a.name])).toEqual([
      ["A001", "AOO One di Ente"],
      ["U001", "UO One di AOO One di Ente (U001)"],
      ["U003", "UO Two di Ente (U003)"],
    ]);
  });
});
