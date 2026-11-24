import { randomUUID } from "crypto";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  Attribute,
  ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  PUBLIC_ADMINISTRATIONS_TYPOLOGY,
  unsafeBrandId,
} from "pagopa-interop-models";
import { expect, describe, it, beforeEach } from "vitest";

import type {
  Classification,
  Institution,
  SubUnit,
} from "../src/services/openDataExtractor.js";

import { config } from "../src/config/config.js";
import {
  TenantSeed,
  getNewAttributes,
} from "../src/services/ipaCertifiedAttributesImporterService.js";
import { agency, aoo, attributes, uo } from "./expectation.js";

describe("NewAttributes", async () => {
  const getMockInstitution = ({
    originId,
    classification,
    subUnit,
    category,
  }: {
    originId: string;
    classification: Classification;
    subUnit: SubUnit;
    category: string;
  }): Institution => ({
    id: `tax-${originId}`,
    originId,
    category,
    description: subUnit.name,
    origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
    kind: PUBLIC_ADMINISTRATIONS_TYPOLOGY,
    classification,
    subUnit,
  });

  const aooUoInstitutions = [
    getMockInstitution({
      originId: "A001",
      classification: "AOO",
      subUnit: {
        name: "SCPGI",
        entityName: "Scuola Primaria Giovanni Pascoli",
      },
      category: "SA",
    }),
    getMockInstitution({
      originId: "U001",
      classification: "UO",
      subUnit: {
        name: "Ufficio per la transizione al Digitale",
        entityName: "Scuola Primaria Giovanni Pascoli",
        aooCode: "A001",
      },
      category: "SA",
    }),
    getMockInstitution({
      originId: "U002",
      classification: "UO",
      subUnit: {
        name: "Ufficio per la transizione al Digitale",
        entityName: "LICEO SCIENTIFICO STATALE GALILEO GALILEI",
      },
      category: "L33",
    }),
    getMockInstitution({
      originId: "U003",
      classification: "UO",
      subUnit: {
        name: "Ufficio per la transizione al Digitale",
        entityName: "LICEO SCIENTIFICO STATALE GALILEO GALILEI",
      },
      category: "L33",
    }),
    getMockInstitution({
      originId: "U004",
      classification: "UO",
      subUnit: {
        name: "Ufficio Tecnico",
        entityName: "Fondazione di partecipazione Casa dell'Ospitalità",
      },
      category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
    }),
  ];
  const aooUoSeeds: TenantSeed[] = aooUoInstitutions.map((i) => ({
    origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
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
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
            code: assignedAttributes[0].code,
          },
          {
            origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
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
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        originId: "1",
        description: "tenant1",
        attributes: [
          {
            origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
            code: assignedAttributes[0].code,
          },
          {
            origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
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
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
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
    const aooAttributeName = "SCPGI di Scuola Primaria Giovanni Pascoli";
    const uoWithAooAttributeName =
      "Ufficio per la transizione al Digitale di SCPGI di Scuola Primaria Giovanni Pascoli";
    const uoWithoutAooAttributeName =
      "Ufficio per la transizione al Digitale di LICEO SCIENTIFICO STATALE GALILEO GALILEI";

    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(aooUoRegistryData, aooUoSeeds, []);
    expect(result.map((a) => [a.code, a.name])).toEqual([
      ["A001", aooAttributeName],
      ["U001", uoWithAooAttributeName],
      ["U002", `${uoWithoutAooAttributeName} (U002)`],
      ["U003", `${uoWithoutAooAttributeName} (U003)`],
    ]);
  });

  it("should return AOO/UO attributes idempotently and suffix names already in the platform", () => {
    const uoWithAooAttributeName =
      "Ufficio per la transizione al Digitale di SCPGI di Scuola Primaria Giovanni Pascoli";
    const platformAttributes = [
      {
        ...getMockAttribute(),
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        code: "A001",
        name: "x",
      },
      {
        ...getMockAttribute(),
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        code: "Z",
        name: uoWithAooAttributeName,
      },
    ];
    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(
      aooUoRegistryData,
      aooUoSeeds,
      platformAttributes
    );
    expect(result.map((a) => a.code)).toEqual(["U001", "U002", "U003"]);
    expect(result[0].name).toBe(`${uoWithAooAttributeName} (U001)`);
  });

  it("should return AOO/UO attributes case-insensitively and avoid suffixed name collisions", () => {
    const aooAttributeName = "SCPGI di Scuola Primaria Giovanni Pascoli";
    const uoWithAooAttributeName =
      "Ufficio per la transizione al Digitale di SCPGI di Scuola Primaria Giovanni Pascoli";
    const uoWithoutAooAttributeName =
      "Ufficio per la transizione al Digitale di LICEO SCIENTIFICO STATALE GALILEO GALILEI";
    const uoWithoutAooAttributeNameWithCode = `${uoWithoutAooAttributeName} (U002)`;
    const lowercaseUoWithAooAttributeName =
      "ufficio per la transizione al digitale di scpgi di scuola primaria giovanni pascoli";

    const platformAttributes = [
      {
        ...getMockAttribute(),
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        code: "Z",
        name: lowercaseUoWithAooAttributeName,
      },
      {
        ...getMockAttribute(),
        origin: PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        code: "Y",
        name: uoWithoutAooAttributeNameWithCode,
      },
    ];
    config.featureFlagAooUoAttributes = true;
    const result = getNewAttributes(
      { institutions: aooUoInstitutions, attributes: [] },
      aooUoSeeds,
      platformAttributes
    );
    expect(result.map((a) => [a.code, a.name])).toEqual([
      ["A001", aooAttributeName],
      ["U001", `${uoWithAooAttributeName} (U001)`],
      ["U003", `${uoWithoutAooAttributeName} (U003)`],
    ]);
  });
});
