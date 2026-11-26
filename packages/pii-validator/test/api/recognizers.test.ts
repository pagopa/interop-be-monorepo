import moo from "moo";
import { describe, expect, it, vi } from "vitest";

import { detectCategories } from "../../src/services/recognizers.js";

describe("recognition families", () => {
  it("keeps deferred documents and fiscal code inactive", () => {
    expect(
      detectCategories("RSSMRA80A01H501U CA12345AA U1T86I309C 71C68F093D")
    ).toEqual([]);
  });

  it("scans the numeric family once for all three categories", () => {
    const compile = vi.spyOn(moo, "compile");
    try {
      expect(
        detectCategories("12345678901, 4111111111111111, 3494096457")
      ).toEqual(["IT_VAT_CODE", "CREDIT_CARD", "IT_PHONE_NUMBER"]);
      expect(
        compile.mock.calls.filter(([rules]) => "numericCandidate" in rules)
      ).toHaveLength(1);
    } finally {
      compile.mockRestore();
    }
  });
  it("shares each candidate, checks categories independently and orders unique results", () => {
    const candidate = { text: "synthetic", start: 0, end: 9 };
    const extract = vi.fn(() => [candidate, candidate]);
    const card = vi.fn(() => true);
    const vat = vi.fn(() => true);
    const phone = vi.fn(() => false);
    expect(
      detectCategories("synthetic", [
        {
          extract,
          validators: [
            { category: "IT_PHONE_NUMBER", check: phone },
            { category: "CREDIT_CARD", check: card },
            { category: "IT_VAT_CODE", check: vat },
          ],
        },
      ])
    ).toEqual(["IT_VAT_CODE", "CREDIT_CARD"]);
    expect(extract).toHaveBeenCalledExactlyOnceWith("synthetic");
    expect(card).toHaveBeenCalledExactlyOnceWith(candidate, "synthetic");
    expect(vat).toHaveBeenCalledExactlyOnceWith(candidate, "synthetic");
    expect(phone).toHaveBeenCalledTimes(2);
  });

  it.each(["creation", "iteration", "checker"])(
    "sanitizes %s failures including stack and cause",
    (stage) => {
      const sentinel = "PRIVATE_CORE_SENTINEL";
      const fail = () => {
        throw new Error(sentinel, { cause: new Error(sentinel) });
      };
      const candidate = { text: sentinel, start: 0, end: sentinel.length };
      const extract =
        stage === "creation"
          ? fail
          : function* () {
              yield candidate;
              if (stage === "iteration") fail();
            };
      try {
        detectCategories(sentinel, [
          {
            extract,
            validators: [
              {
                category: "EMAIL_ADDRESS",
                check: stage === "checker" ? fail : () => false,
              },
            ],
          },
        ]);
        expect.fail("Expected recognition failure");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (!(error instanceof Error)) throw error;
        expect(error.message).toBe("PII recognition failed");
        expect(error.cause).toBeUndefined();
        expect(error.stack).not.toContain(sentinel);
      }
    }
  );
});
