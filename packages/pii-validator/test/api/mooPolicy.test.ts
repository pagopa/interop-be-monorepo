import { describe, expect, it } from "vitest";

import { detectionService } from "../../src/services/detectionService.js";

const categories = async (text: string) =>
  (await detectionService.detect({ fields: [{ fieldId: "example", text }] }))
    .results[0].detectedCategories;

describe("Moo literal/fallback detection policy", () => {
  it("keeps fiscal code and identity card inactive while recognizing both license prefixes", async () => {
    const result = await categories(
      "RSSMRA80A01H501U CA12345AA U1T86I309C 71C68F093D"
    );
    expect(result).toContain("IT_DRIVER_LICENSE");
    expect(result).not.toContain("IT_FISCAL_CODE");
    expect(result).not.toContain("IT_IDENTITY_CARD");
  });

  it.each([
    ["IBAN_CODE", "IT60X0542811101000000123456", true],
    ["IBAN_CODE", "IT60X0542811101000000123456A", false],
    ["IBAN_CODE", "IT60 X054 2811 1010 0000 0123 456", false],
    ["CREDIT_CARD", "4111111111111111", true],
    ["CREDIT_CARD", "41111111111111112", false],
    ["CREDIT_CARD", "4111 1111 1111 1111", false],
    ["PHONE_NUMBER", "3494096457", true],
    ["PHONE_NUMBER", "+39 3494096457", true],
    ["PHONE_NUMBER", "+39-3494096457", false],
    ["PHONE_NUMBER", "349-4096457", false],
    ["PHONE_NUMBER", "34940964571", false],
    ["IT_DRIVER_LICENSE", "U1T86I309C", true],
    ["IT_DRIVER_LICENSE", "71C68F093D", true],
    ["IT_DRIVER_LICENSE", "U1T86I309CA", false],
    ["IT_DRIVER_LICENSE", "71C68F0930", false],
    ["IT_VAT_CODE", "IT12345678901", true],
    ["IT_VAT_CODE", "12345678901", true],
    ["IT_VAT_CODE", "a12345678901b", true],
    ["IT_VAT_CODE", "123456789012", false],
  ] as const)("sets %s=%s for %s", async (category, text, expected) => {
    expect((await categories(text)).includes(category)).toBe(expected);
  });

  it.each([
    "4111111111111111 2222",
    "4111111111111111-2222",
    "4111111111111111/2222",
    "4111111111111111\u00a02222",
  ])(
    "rejects a compact card prefix followed by a numeric group: %s",
    async (text) => {
      expect(await categories(text)).not.toContain("CREDIT_CARD");
    }
  );

  it("classifies overlapping categories independently", async () => {
    const result = await categories(
      "qa@example.com 4111111111111111 IT60X0542811101000000123456 3494096457 U1T86I309C"
    );
    expect(result).toEqual([
      "EMAIL_ADDRESS",
      "IBAN_CODE",
      "CREDIT_CARD",
      "PHONE_NUMBER",
      "IT_DRIVER_LICENSE",
    ]);
  });

  it.each([
    "+39  3494096457",
    "+39\t3494096457",
    "+39-3494096457",
    "+39\n3494096457",
    "+39–3494096457",
    "+39/3494096457",
    "+39:3494096457",
    "+39)3494096457",
    "+39\u00a03494096457",
    "+39 3494096457 9",
    "+39 3494096457\u00a09",
  ])(
    "does not recover a bare mobile from malformed context: %s",
    async (text) => {
      expect(await categories(text)).not.toContain("PHONE_NUMBER");
    }
  );

  it.each([
    ["IBAN_CODE", "éIT60X0542811101000000123456"],
    ["IT_DRIVER_LICENSE", "éU1T86I309C"],
    ["CREDIT_CARD", "é4111111111111111"],
    ["PHONE_NUMBER", "é3494096457"],
  ] as const)(
    "does not match %s inside a Unicode word",
    async (category, text) => {
      expect(await categories(text)).not.toContain(category);
    }
  );
});
