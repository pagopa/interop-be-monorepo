import { randomUUID } from "crypto";
import { Attribute, unsafeBrandId } from "pagopa-interop-models";
import { expect, describe, it } from "vitest";

import type { Institution } from "../src/services/openDataExtractor.js";

import {
  TenantSeed,
  getNewAttributes,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

describe("NewAttributes", async () => {
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
});

describe("NewAttributes - AOO/UO A4", () => {
  const entity = (
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

  const institutions = [
    entity("A001", "AOO", { name: "AOO One", entityName: "Ente" }),
    entity("U001", "UO", {
      name: "UO One",
      entityName: "Ente",
      aooCode: "A001",
    }),
    entity("U002", "UO", { name: "UO Two", entityName: "Ente" }),
    entity("U003", "UO", { name: "UO Two", entityName: "Ente" }),
    entity("U004", "UO", { name: "UO Scec", entityName: "Ente" }, "S01G"),
  ];
  const seeds: TenantSeed[] = institutions.map((i) => ({
    origin: "IPA",
    originId: i.originId,
    description: i.description,
    attributes: [],
  }));
  const registryData = { institutions, attributes: [] };

  it("creates A4 seeds only when the flag is enabled", () => {
    expect(getNewAttributes(registryData, seeds, [])).toEqual([]);
  });

  it("composes names, handles collisions and excludes SCEC", () => {
    const result = getNewAttributes(registryData, seeds, [], true);
    expect(result.map((a) => [a.code, a.name])).toEqual([
      ["A001", "AOO One di Ente"],
      ["U001", "UO One di AOO One di Ente"],
      ["U002", "UO Two di Ente (U002)"],
      ["U003", "UO Two di Ente (U003)"],
    ]);
  });

  it("is idempotent and suffixes names already in the platform", () => {
    const platform = [
      { origin: "IPA", code: "A001", kind: "Certified", name: "x" },
      {
        origin: "IPA",
        code: "Z",
        kind: "Certified",
        name: "UO One di AOO One di Ente",
      },
    ] as unknown as Attribute[];
    const result = getNewAttributes(registryData, seeds, platform, true);
    expect(result.map((a) => a.code)).toEqual(["U001", "U002", "U003"]);
    expect(result[0].name).toBe("UO One di AOO One di Ente (U001)");
  });
});
