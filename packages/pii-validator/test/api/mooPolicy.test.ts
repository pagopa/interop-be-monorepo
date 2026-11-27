import { describe, expect, it } from "vitest";

import { detectionService } from "../../src/services/detectionService.js";

const categories = async (text: string) =>
  (await detectionService.detect({ fields: [{ fieldId: "example", text }] }))
    .results[0].detectedCategories;

describe("Moo candidate detection policy", () => {
  it.each(["CA12345AA", "U1B123456C", "IT60X0542811101000000123456"])(
    "keeps Unicode-attached identifiers whole before category validation: %s",
    async (identifier) => {
      for (const adjacent of ["漢", "𐐀", "\u0301", "١"]) {
        for (const source of [adjacent + identifier, identifier + adjacent]) {
          const result = await categories(source);
          expect(result).not.toContain("IT_CIE");
          expect(result).not.toContain("IT_DRIVER_LICENSE");
          expect(result).not.toContain("IT_IBAN_CODE");
        }
      }
    }
  );

  it("keeps fiscal code inactive", async () => {
    const result = await categories("RSSMRA80A01H501U");
    expect(result).not.toContain("IT_DRIVER_LICENSE");
    expect(result).not.toContain("IT_FISCAL_CODE");
    expect(result).not.toContain("IT_CIE");
  });

  it.each([
    ["IT_CIE", "CA12345AA", true],
    ["IT_CIE", "ca12345aa", true],
    ["IT_CIE", "CA00000AA", false],
    ["IT_CIE", "CA123456AA", false],
    ["IT_CIE", "xCA12345AA", false],
    ["IT_CIE", "éCA12345AA", false],
    ["IT_CIE", "CA12345AA_foo", false],
    ["IT_CIE", "CA12345AA\u0301", false],
    ["IT_DRIVER_LICENSE", "U11234567A", true],
    ["IT_DRIVER_LICENSE", "U1B123456C", true],
    ["IT_DRIVER_LICENSE", "U1 B123456 C", false],
    ["IT_DRIVER_LICENSE", "éU1B123456C", false],
    ["IT_DRIVER_LICENSE", "U1B123456C_suffix", false],
    ["IT_DRIVER_LICENSE", "U1I123456C", false],
    ["IT_DRIVER_LICENSE", "u1b123456c", false],
    ["IT_IBAN_CODE", "DE89370400440532013000", false],
    ["IT_IBAN_CODE", "it60X0542811101000000123456", false],
    ["EMAIL_ADDRESS", "foo!bar@example.com", true],
    ["EMAIL_ADDRESS", "a#b@example.com", true],
    ["EMAIL_ADDRESS", "é@example.com", true],
    ["IT_IBAN_CODE", "IT60X0542811101000000123456", true],
    ["IT_IBAN_CODE", "IT60X0542811101000000123456A", false],
    ["IT_IBAN_CODE", "IT60 X054 2811 1010 0000 0123 456", false],
    ["CREDIT_CARD", "4111111111111111", true],
    ["CREDIT_CARD", "41111111111111112", false],
    ["CREDIT_CARD", "4111 1111 1111 1111", true],
    ["IT_PHONE_NUMBER", "349 409 6457", true],
    ["IT_PHONE_NUMBER", "+39  349 409 6457", true],
    ["IT_PHONE_NUMBER", "3494096457", true],
    ["IT_PHONE_NUMBER", "+39 3494096457", true],
    ["IT_PHONE_NUMBER", "+39-3494096457", false],
    ["IT_PHONE_NUMBER", "349-4096457", false],
    ["IT_PHONE_NUMBER", "34940964571", false],
    ["IT_VAT_CODE", "IT12345678901", true],
    ["IT_VAT_CODE", "12345678901", true],
    ["IT_VAT_CODE", "a12345678901b", false],
    ["IT_VAT_CODE", "123 456 78901", true],
    ["IT_VAT_CODE", "IT123 456 78901", true],
    ["IT_VAT_CODE", "é12345678901", false],
    ["IT_VAT_CODE", "12345678901é", false],
    ["IT_VAT_CODE", "IT12345678901A", false],
    ["IT_VAT_CODE", "12345678901 2", false],
    ["IT_VAT_CODE", "12345678901-2", false],
    ["IT_VAT_CODE", "12345678901/2", false],
    ["IT_VAT_CODE", "+12345678901", false],
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

  it.each([
    ["IT_PHONE_NUMBER", "é123456 3494096457"],
    ["CREDIT_CARD", "Ω123456 4111111111111111"],
    ["IT_PHONE_NUMBER", "1: +39 3494096457"],
  ] as const)(
    "preserves %s after unrelated context: %s",
    async (category, text) => {
      expect(await categories(text)).toContain(category);
    }
  );

  it("classifies overlapping categories independently", async () => {
    const result = await categories(
      "qa@example.com 4111111111111111 IT60X0542811101000000123456 3494096457 U1T86I309C"
    );
    expect(result).toEqual([
      "EMAIL_ADDRESS",
      "IT_IBAN_CODE",
      "CREDIT_CARD",
      "IT_PHONE_NUMBER",
    ]);
  });

  it.each([
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
      expect(await categories(text)).not.toContain("IT_PHONE_NUMBER");
    }
  );

  it.each([
    ["IT_IBAN_CODE", "éIT60X0542811101000000123456"],
    ["CREDIT_CARD", "é4111111111111111"],
    ["IT_PHONE_NUMBER", "é3494096457"],
  ] as const)(
    "does not match %s inside a Unicode word",
    async (category, text) => {
      expect(await categories(text)).not.toContain(category);
    }
  );
});
