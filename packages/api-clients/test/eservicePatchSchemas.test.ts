import { describe, expect, it } from "vitest";

import * as bffApi from "../src/generated/bffApi.js";
import * as catalogApi from "../src/generated/catalogApi.js";
import * as m2mGatewayApiV3 from "../src/generated/m2mGatewayApiV3.js";

describe.each([
  { surface: "catalog", schema: catalogApi.EServiceDescriptorAttributeSeed },
  {
    surface: "M2M v3",
    schema: m2mGatewayApiV3.EServiceDescriptorAttributeSeed,
  },
])("$surface existing minProperties contract", ({ schema }) => {
  it("rejects empty objects and preserves the existing field", () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.parse({ dailyCallsPerConsumer: 1 })).toEqual({
      dailyCallsPerConsumer: 1,
    });
  });
});

describe.each([
  { surface: "catalog", schema: catalogApi.PatchUpdateEServiceSeed },
  { surface: "BFF", schema: bffApi.PatchUpdateEServiceSeed },
  { surface: "M2M v3", schema: m2mGatewayApiV3.EServiceDraftUpdateSeed },
])("$surface generated E-Service PATCH schema", ({ schema }) => {
  it.each([
    {},
    { name: null },
    { name: 123 },
    { name: "a".repeat(4) },
    { name: "a".repeat(61) },
    { description: null },
    { description: "a".repeat(9) },
    { description: "a".repeat(401) },
    { name: "valid name", unknown: true },
    { technology: "invalid" },
    { mode: "invalid" },
  ])("rejects invalid payload %#", (seed) => {
    expect(schema.safeParse(seed).success).toBe(false);
  });

  it.each([
    { name: "a".repeat(5) },
    { name: "a".repeat(60) },
    { description: "a".repeat(10) },
    { description: "a".repeat(400) },
    { personalData: null },
    { asyncExchange: null },
    { isSignalHubEnabled: false },
    {
      name: "valid name",
      description: "valid description",
      technology: "REST",
      mode: "DELIVER",
      isSignalHubEnabled: false,
      isConsumerDelegable: true,
      isClientAccessDelegable: true,
      personalData: null,
      asyncExchange: null,
    },
  ])("preserves valid payload %# without adding omitted fields", (seed) => {
    expect(schema.parse(seed)).toEqual(seed);
  });
});
