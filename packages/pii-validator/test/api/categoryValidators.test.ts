import validator from "validator";
import { describe, expect, it, vi } from "vitest";

import {
  isCardCandidate,
  isCieCandidate,
  isItalianDriverLicenseCandidate,
  isEmailCandidate,
  isIbanCandidate,
  isPhoneCandidate,
  isVatCandidate,
} from "../../src/services/categoryValidators.js";

const candidate = (text: string) => ({ text, start: 0, end: text.length });

describe("category validators", () => {
  it.each([
    "CA12345AA",
    "ca12345aa",
    "CA00000AA",
    "ca00000aa",
    "AA12345AA",
    "CA123456AA",
  ])("delegates CIE policy to the Italian library checker: %s", (text) => {
    const value = Object.freeze(candidate(text));
    expect(isCieCandidate(value)).toBe(validator.isIdentityCard(text, "IT"));
    expect(value.text).toBe(text);
  });

  it("calls the public CIE checker with the exact original candidate", () => {
    const check = vi.spyOn(validator, "isIdentityCard").mockReturnValue(true);
    try {
      expect(isCieCandidate(candidate("untouched"))).toBe(true);
      expect(check).toHaveBeenCalledExactlyOnceWith("untouched", "IT");
    } finally {
      check.mockRestore();
    }
  });

  it.each(["U11234567A", "U1B123456C", "U1Z000000I"])(
    "recognizes a supported Italian licence format: %s",
    (text) => {
      expect(
        isItalianDriverLicenseCandidate(Object.freeze(candidate(text)))
      ).toBe(true);
    }
  );

  it.each([
    "U1123456A",
    "U112345678A",
    "U112345671",
    "U2B123456C",
    "U1A123456C",
    "U1I123456C",
    "U1O123456C",
    "U1Q123456C",
    "U1T86I309C",
    "71C68F093D",
    "MI1234567A",
    "u1b123456c",
    "U1 B123456 C",
    "U1B-123456C",
    "U1B123456C\n",
    "xU1B123456C",
    "U1B123456Cx",
    "U1B123456C\r\n",
    "U1B123456C😀",
  ])(
    "rejects a candidate outside the supported licence formats: %s",
    (text) => {
      expect(isItalianDriverLicenseCandidate(candidate(text))).toBe(false);
    }
  );

  it.each([
    "DE89370400440532013000",
    "it60X0542811101000000123456",
    "It60X0542811101000000123456",
    "IT60 X054 2811 1010 0000 0123 456",
    "IT60X0542811101000000123456\n",
  ])("keeps the Italian compact IBAN policy in its validator: %s", (text) => {
    expect(isIbanCandidate(candidate(text))).toBe(false);
  });
  it.each([
    [isEmailCandidate, "qa@example.com", "qa@"],
    [isVatCandidate, "IT123 456 78901", "IT123"],
    [isCardCandidate, "4111 1111 1111 1111", "4111 1111 1111 1112"],
    [
      isIbanCandidate,
      "IT60X0542811101000000123456",
      "IT60X0542811101000000123457",
    ],
  ])("checks a whole candidate with %s", (check, valid, invalid) => {
    expect(check(candidate(valid))).toBe(true);
    expect(check(candidate(invalid))).toBe(false);
  });

  it("normalizes only ASCII spaces in Italian mobiles", () => {
    expect(
      isPhoneCandidate(candidate("+39  349 409 6457"), "+39  349 409 6457")
    ).toBe(true);
    expect(isPhoneCandidate(candidate("349\t4096457"), "349\t4096457")).toBe(
      false
    );
    expect(isPhoneCandidate(candidate("0612345678"), "0612345678")).toBe(false);
  });

  it("keeps malformed-prefix policy local to phones", () => {
    const source = "39:3494096457";
    const value = { text: "3494096457", start: 3, end: source.length };
    expect(isPhoneCandidate(value, source)).toBe(false);
    expect(isPhoneCandidate({ ...value, start: 0 }, value.text)).toBe(true);
  });

  it("calls the public checker lazily after import without mutating the candidate", () => {
    const value = candidate("IT123 456 78901");
    const check = vi.spyOn(validator, "isVAT").mockReturnValue(true);
    try {
      expect(isVatCandidate(value)).toBe(true);
      expect(check).toHaveBeenCalledWith("IT12345678901", "IT");
      expect(value.text).toBe("IT123 456 78901");
    } finally {
      check.mockRestore();
    }
  });
});
