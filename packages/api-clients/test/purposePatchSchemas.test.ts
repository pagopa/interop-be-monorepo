import { describe, expect, it } from "vitest";

import * as bffApi from "../src/generated/bffApi.js";
import * as m2mGatewayApiV3 from "../src/generated/m2mGatewayApiV3.js";
import * as purposeApi from "../src/generated/purposeApi.js";

describe.each([
  { surface: "process", schema: purposeApi.PatchPurposeUpdateContent },
  { surface: "BFF", schema: bffApi.PatchPurposeUpdateContent },
  { surface: "M2M v3", schema: m2mGatewayApiV3.PurposeDraftUpdateSeed },
  {
    surface: "reverse process",
    schema: purposeApi.PatchReversePurposeUpdateContent,
  },
  { surface: "reverse BFF", schema: bffApi.PatchReversePurposeUpdateContent },
  {
    surface: "reverse M2M v3",
    schema: m2mGatewayApiV3.ReversePurposeDraftUpdateSeed,
  },
])("$surface generated Purpose PATCH schema", ({ schema }) => {
  it.each([
    {},
    { title: null },
    { title: 123 },
    { title: "a".repeat(4) },
    { title: "a".repeat(61) },
    { description: null },
    { description: "a".repeat(9) },
    { description: "a".repeat(251) },
    { title: "valid title", unknown: true },
    { isFreeOfCharge: "invalid" },
    { freeOfChargeReason: 123 },
    { dailyCalls: null },
    { dailyCalls: 0 },
    { dailyCalls: 1000000001 },
    { dailyCalls: 1.5 },
  ])("rejects invalid payload %#", (seed) => {
    expect(schema.safeParse(seed).success).toBe(false);
  });

  it.each([
    { title: "a".repeat(5) },
    { title: "a".repeat(60) },
    { description: "a".repeat(10) },
    { description: "a".repeat(250) },
    { freeOfChargeReason: null },
    { isFreeOfCharge: false },
    { dailyCalls: 1 },
    { dailyCalls: 1000000000 },
    {
      title: "valid title",
      description: "valid description",
      isFreeOfCharge: false,
      freeOfChargeReason: null,
      dailyCalls: 99,
    },
  ])("preserves valid payload %# without adding omitted fields", (seed) => {
    expect(schema.parse(seed)).toEqual(seed);
  });
});

describe.each([
  { surface: "process", schema: purposeApi.PatchPurposeUpdateContent },
  { surface: "BFF", schema: bffApi.PatchPurposeUpdateContent },
  { surface: "M2M v3", schema: m2mGatewayApiV3.PurposeDraftUpdateSeed },
])("$surface ordinary Purpose risk analysis", ({ schema }) => {
  it("accepts riskAnalysisForm", () => {
    const seed = { riskAnalysisForm: { version: "3.0", answers: {} } };
    expect(schema.parse(seed)).toEqual(seed);
  });

  it.each([null, {}, { version: "3.0" }])(
    "rejects invalid form %#",
    (riskAnalysisForm) => {
      expect(schema.safeParse({ riskAnalysisForm }).success).toBe(false);
    }
  );
});

describe.each([
  { surface: "process", schema: purposeApi.PatchReversePurposeUpdateContent },
  { surface: "BFF", schema: bffApi.PatchReversePurposeUpdateContent },
  { surface: "M2M v3", schema: m2mGatewayApiV3.ReversePurposeDraftUpdateSeed },
])("$surface reverse Purpose risk analysis", ({ schema }) => {
  it("rejects riskAnalysisForm even with valid metadata", () => {
    expect(
      schema.safeParse({
        title: "valid title",
        riskAnalysisForm: { version: "3.0", answers: {} },
      }).success
    ).toBe(false);
  });
});

describe("M2M v3 Purpose PATCH template alternative", () => {
  it("rejects empty objects and preserves partial template updates", () => {
    const schema = m2mGatewayApiV3.PurposeDraftFromTemplateUpdateSeed;
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.parse({ title: "valid title" })).toEqual({
      title: "valid title",
    });
  });
});
