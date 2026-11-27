import { describe, expect, it } from "vitest";

import { getLocaleFromAcceptLanguageHeader } from "../src/utilities/middlewares.js";

describe("getLocaleFromAcceptLanguageHeader", () => {
  it("should select Italian when it has the highest quality value", () => {
    expect(getLocaleFromAcceptLanguageHeader("en;q=0.5, it;q=0.9")).toBe("it");
  });

  it("should select English when it has the highest quality value", () => {
    expect(getLocaleFromAcceptLanguageHeader("it;q=0.5, en;q=0.9")).toBe("en");
  });

  it("should use header order when quality values are equal", () => {
    expect(getLocaleFromAcceptLanguageHeader("en;q=0.8, it;q=0.8")).toBe("en");
  });

  it("should treat a missing quality value as 1", () => {
    expect(getLocaleFromAcceptLanguageHeader("en;q=0.5, it")).toBe("it");
  });

  it("should skip languages with a quality value of 0", () => {
    expect(getLocaleFromAcceptLanguageHeader("it;q=0, en;q=0.5")).toBe("en");
  });

  it("should match regional language tags to their base language", () => {
    expect(getLocaleFromAcceptLanguageHeader("it-IT;q=0.4, en-GB;q=0.8")).toBe(
      "en"
    );
  });

  it("should select English when an unsupported language is preferred", () => {
    expect(
      getLocaleFromAcceptLanguageHeader("fr;q=1, en;q=0.8, it;q=0.5")
    ).toBe("en");
    expect(getLocaleFromAcceptLanguageHeader("fr")).toBe("en");
  });

  it("should return undefined when no language is acceptable", () => {
    expect(getLocaleFromAcceptLanguageHeader("fr;q=0, it;q=0, en;q=0")).toBe(
      undefined
    );
  });
});
