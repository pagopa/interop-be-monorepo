import { describe, expect, it } from "vitest";

import * as bffApi from "../src/generated/bffApi.js";
import * as m2mGatewayApiV3 from "../src/generated/m2mGatewayApiV3.js";
import * as purposeTemplateApi from "../src/generated/purposeTemplateApi.js";

describe.each([
  {
    surface: "process",
    schema: purposeTemplateApi.PatchUpdatePurposeTemplateSeed,
  },
  { surface: "BFF", schema: bffApi.PatchUpdatePurposeTemplateSeed },
  {
    surface: "M2M v3",
    schema: m2mGatewayApiV3.PurposeTemplateDraftUpdateSeed,
  },
])(
  "$surface generated Purpose Template PATCH schema",
  ({ surface, schema }) => {
    it("preserves empty-payload compatibility outside the new BFF route", () => {
      expect(schema.safeParse({}).success).toBe(surface !== "BFF");
    });

    it.each([
      { purposeTitle: null },
      { purposeTitle: 123 },
      { purposeTitle: "a".repeat(4) },
      { purposeTitle: "a".repeat(61) },
      { purposeDescription: null },
      { purposeDescription: "a".repeat(9) },
      { purposeDescription: "a".repeat(251) },
      { targetDescription: null },
      { targetDescription: "a".repeat(9) },
      { targetDescription: "a".repeat(251) },
      { purposeTitle: "valid title", unknown: true },
      { targetTenantKind: "invalid" },
      { purposeIsFreeOfCharge: null },
      { purposeFreeOfChargeReason: 123 },
      { purposeDailyCalls: 0 },
      { purposeDailyCalls: 1000000001 },
      { handlesPersonalData: "invalid" },
    ])("rejects invalid payload %#", (seed) => {
      expect(schema.safeParse(seed).success).toBe(false);
    });

    it.each([
      { purposeTitle: "a".repeat(5) },
      { purposeTitle: "a".repeat(60) },
      { purposeDescription: "a".repeat(10) },
      { purposeDescription: "a".repeat(250) },
      { targetDescription: "a".repeat(10) },
      { targetDescription: "a".repeat(250) },
      { purposeFreeOfChargeReason: null },
      { purposeDailyCalls: null },
      { purposeDailyCalls: 1 },
      { purposeDailyCalls: 1000000000 },
      { purposeIsFreeOfCharge: false },
      { handlesPersonalData: false },
      {
        purposeTitle: "valid title",
        purposeDescription: "valid description",
        targetDescription: "valid target description",
        targetTenantKind: "PRIVATE",
        purposeIsFreeOfCharge: false,
        purposeFreeOfChargeReason: null,
        purposeDailyCalls: 10,
        handlesPersonalData: true,
      },
    ])("preserves valid payload %# without adding omitted fields", (seed) => {
      expect(schema.parse(seed)).toEqual(seed);
    });
  }
);
