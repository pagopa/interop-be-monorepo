import { describe, expect, it } from "vitest";

import * as bffApi from "../src/generated/bffApi.js";
import * as catalogApi from "../src/generated/catalogApi.js";
import * as eserviceTemplateApi from "../src/generated/eserviceTemplateApi.js";
import * as m2mGatewayApiV3 from "../src/generated/m2mGatewayApiV3.js";

describe.each([
  {
    surface: "process",
    schema: eserviceTemplateApi.PatchUpdateEServiceTemplateSeed,
  },
  { surface: "BFF", schema: bffApi.PatchUpdateEServiceTemplateSeed },
  {
    surface: "M2M v3",
    schema: m2mGatewayApiV3.EServiceTemplateDraftUpdateSeed,
  },
])(
  "$surface generated E-Service Template PATCH schema",
  ({ surface, schema }) => {
    it("preserves empty-payload compatibility outside the new BFF route", () => {
      expect(schema.safeParse({}).success).toBe(surface !== "BFF");
    });

    it.each([
      { name: null },
      { name: 123 },
      { name: "a".repeat(4) },
      { name: "a".repeat(46) },
      { description: null },
      { description: "a".repeat(9) },
      { description: "a".repeat(401) },
      { intendedTarget: null },
      { intendedTarget: "a".repeat(9) },
      { intendedTarget: "a".repeat(251) },
      { name: "valid name", unknown: true },
      { technology: "invalid" },
      { mode: "invalid" },
    ])("rejects invalid payload %#", (seed) => {
      expect(schema.safeParse(seed).success).toBe(false);
    });

    it.each([
      { name: "a".repeat(5) },
      { name: "a".repeat(45) },
      { description: "a".repeat(10) },
      { description: "a".repeat(400) },
      { intendedTarget: "a".repeat(10) },
      { intendedTarget: "a".repeat(250) },
      { personalData: null },
      { isSignalHubEnabled: false },
      {
        name: "valid name",
        description: "valid description",
        intendedTarget: "valid intended target",
        technology: "REST",
        mode: "DELIVER",
        isSignalHubEnabled: false,
        personalData: null,
      },
    ])("preserves valid payload %# without adding omitted fields", (seed) => {
      expect(schema.parse(seed)).toEqual(seed);
    });
  }
);

describe.each([
  {
    surface: "process",
    schema: eserviceTemplateApi.EServiceTemplateNameUpdateSeed,
  },
  { surface: "BFF", schema: bffApi.EServiceTemplateNameUpdateSeed },
  { surface: "M2M v3", schema: m2mGatewayApiV3.EServiceTemplateNameUpdateSeed },
])("$surface legacy template rename schema", ({ schema }) => {
  it.each([5, 45])("accepts a name of %s characters", (length) => {
    const seed = { name: "a".repeat(length) };
    expect(schema.parse(seed)).toEqual(seed);
  });

  it.each([4, 46, 60])("rejects a name of %s characters", (length) => {
    expect(schema.safeParse({ name: "a".repeat(length) }).success).toBe(false);
  });
});

describe("E-Service Template asyncExchange contract", () => {
  it.each([
    eserviceTemplateApi.PatchUpdateEServiceTemplateSeed,
    bffApi.PatchUpdateEServiceTemplateSeed,
  ])("preserves nullable asyncExchange where supported", (schema) => {
    expect(schema.parse({ asyncExchange: null })).toEqual({
      asyncExchange: null,
    });
  });
});

describe("template instance name composition", () => {
  it("accepts a 45-character template name with a 12-character instance label", () => {
    const { name } = eserviceTemplateApi.EServiceTemplateNameUpdateSeed.parse({
      name: "a".repeat(45),
    });
    const { instanceLabel } = catalogApi.InstanceEServiceSeed.parse({
      instanceLabel: "b".repeat(12),
    });
    const instanceName = `${name} - ${instanceLabel}`;
    expect(instanceName).toHaveLength(60);
    expect(
      catalogApi.PatchUpdateEServiceSeed.parse({ name: instanceName })
    ).toEqual({ name: instanceName });
  });
});
