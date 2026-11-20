import { randomUUID } from "crypto";
import { getMockAttribute } from "pagopa-interop-commons-test";
import { Attribute, unsafeBrandId } from "pagopa-interop-models";
import { expect, describe, it, beforeEach } from "vitest";

import type {
  Classification,
  Institution,
} from "../src/services/openDataExtractor.js";

import { config } from "../src/config/config.js";
import {
  TenantSeed,
  getNewAttributes,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

describe("NewAttributes", async () => {
  const getMockInstitution = (
    originId: string,
    classification: Classification,
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
    getMockInstitution("A001", "AOO", {
      name: "SCPGI",
      entityName: "Scuola Primaria Giovanni Pascoli",
    }),
    getMockInstitution("U001", "UO", {
      name: "Ufficio per la transizione al Digitale",
      entityName: "Scuola Primaria Giovanni Pascoli",
      aooCode: "A001",
    }),
    getMockInstitution("U002", "UO", {
      name: "Ufficio per la transizione al Digitale",
      entityName: "LICEO SCIENTIFICO STATALE GALILEO GALILEI",
    }),
    getMockInstitution("U003", "UO", {
      name: "Ufficio per la transizione al Digitale",
      entityName: "LICEO SCIENTIFICO STATALE GALILEO GALILEI",
    }),
    getMockInstitution(
      "U004",
      "UO",
      { name: "Ufficio Tecnico", entityName: "COMUNE DI NAPOLI" },
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

  it("should not return AOO/UO attributes when the feature flag is disabled", () => {
    expect(getNewAttributes(aooUoRegistryData, aooUoSeeds, [])).toEqual([]);
  });

  it("should return AOO/UO attributes with composed names, handling collisions and excluding SCEC", () => {
    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(aooUoRegistryData, aooUoSeeds, []);
    expect(result.map((a) => [a.code, a.name])).toEqual([
      ["A001", "SCPGI di Scuola Primaria Giovanni Pascoli"],
      [
        "U001",
        "Ufficio per la transizione al Digitale di SCPGI di Scuola Primaria Giovanni Pascoli",
      ],
      [
        "U002",
        "Ufficio per la transizione al Digitale di LICEO SCIENTIFICO STATALE GALILEO GALILEI (U002)",
      ],
      [
        "U003",
        "Ufficio per la transizione al Digitale di LICEO SCIENTIFICO STATALE GALILEO GALILEI (U003)",
      ],
    ]);
  });

  it("should return AOO/UO attributes idempotently and suffix names already in the platform", () => {
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
        name: "Ufficio per la transizione al Digitale di SCPGI di Scuola Primaria Giovanni Pascoli",
      },
    ];
    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(aooUoRegistryData, aooUoSeeds, platform);
    expect(result.map((a) => a.code)).toEqual(["U001", "U002", "U003"]);
    expect(result[0].name).toBe(
      "Ufficio per la transizione al Digitale di SCPGI di Scuola Primaria Giovanni Pascoli (U001)"
    );
  });

  it("should return AOO/UO attributes case-insensitively and avoid suffixed name collisions", () => {
    const platform = [
      {
        ...getMockAttribute(),
        origin: "IPA",
        code: "Z",
        name: "ufficio per la transizione al digitale di scpgi di scuola primaria giovanni pascoli",
      },
      {
        ...getMockAttribute(),
        origin: "IPA",
        code: "Y",
        name: "Ufficio per la transizione al Digitale di LICEO SCIENTIFICO STATALE GALILEO GALILEI (U002)",
      },
    ];
    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(
      { institutions: aooUoInstitutions, attributes: [] },
      aooUoSeeds,
      platform
    );
    expect(result.map((a) => [a.code, a.name])).toEqual([
      ["A001", "SCPGI di Scuola Primaria Giovanni Pascoli"],
      [
        "U001",
        "Ufficio per la transizione al Digitale di SCPGI di Scuola Primaria Giovanni Pascoli (U001)",
      ],
      [
        "U003",
        "Ufficio per la transizione al Digitale di LICEO SCIENTIFICO STATALE GALILEO GALILEI (U003)",
      ],
    ]);
  });
});
