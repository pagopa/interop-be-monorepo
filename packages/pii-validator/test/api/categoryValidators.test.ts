import validator from "validator";
import { describe, expect, it, vi } from "vitest";

import {
  isCardCandidate,
  isEmailCandidate,
  isIbanCandidate,
  isPhoneCandidate,
  isVatCandidate,
} from "../../src/services/categoryValidators.js";

const candidate = (text: string) => ({ text, start: 0, end: text.length });

describe("category validators", () => {
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
