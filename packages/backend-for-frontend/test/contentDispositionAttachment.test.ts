import { describe, expect, it } from "vitest";
import { contentDispositionAttachment } from "../src/utilities/fileUtils.js";

describe("contentDispositionAttachment", () => {
  it("should build the header for a plain ASCII filename", () => {
    expect(contentDispositionAttachment("lista-fruitori.csv")).toBe(
      `attachment; filename="lista-fruitori.csv"; filename*=UTF-8''lista-fruitori.csv`
    );
  });

  it("should replace non-ASCII characters in the fallback filename and preserve them in the encoded one", () => {
    const result = contentDispositionAttachment(
      "20240101-lista-fruitori-eservice – test.csv"
    );
    expect(result).toBe(
      `attachment; filename="20240101-lista-fruitori-eservice _ test.csv"; filename*=UTF-8''20240101-lista-fruitori-eservice%20%E2%80%93%20test.csv`
    );
  });

  it("should produce a latin1-safe header value for any filename", () => {
    const filenames = [
      "eservice – test.csv",
      'eservice "quoted" \\ back.csv',
      "eservice with 'single' (parens) *stars*.csv",
      "àccénted èservice ù.csv",
      "emoji 🚀 name.csv",
    ];
    for (const filename of filenames) {
      const result = contentDispositionAttachment(filename);
      // eslint-disable-next-line no-control-regex
      expect(result).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it("should escape quotes and backslashes in the fallback filename", () => {
    const result = contentDispositionAttachment('a"b\\c.csv');
    expect(result).toContain(`filename="a_b_c.csv"`);
  });

  it("should percent-encode RFC 5987 reserved characters in the encoded filename", () => {
    const result = contentDispositionAttachment("a'b(c)d*e.csv");
    expect(result).toContain(`filename*=UTF-8''a%27b%28c%29d%2Ae.csv`);
  });
});
