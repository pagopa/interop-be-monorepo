import moo from "moo";
import { describe, expect, it, vi } from "vitest";

import { candidateSpans } from "../../src/services/candidateSpans.js";

function slices(text: string, spans: Iterable<readonly [number, number]>) {
  return Array.from(spans, ([start, end]) => text.slice(start, end));
}

describe("bounded candidate spans", () => {
  it("reconstructs the entire source from real Moo tokens with UTF-16 offsets", () => {
    const text = "😀 U1T86I309C\nqa@example.com / IT60X0542811101000000123456";
    const compile = moo.compile;
    const tokens: moo.Token[] = [];
    const spy = vi.spyOn(moo, "compile").mockImplementation((rules) => {
      const lexer = compile(rules);
      const next = lexer.next.bind(lexer);
      lexer.next = () => {
        const token = next();
        if (token) tokens.push(token);
        return token;
      };
      return lexer;
    });
    try {
      Array.from(candidateSpans.email(text));
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.map((token) => token.text).join("")).toBe(text);
      for (const token of tokens) {
        expect(token.text).toBe(
          text.slice(token.offset, token.offset + token.text.length)
        );
      }
    } finally {
      spy.mockRestore();
    }
  });
  it("preserves original offsets for compact card candidates", () => {
    const text = "carta (4111111111111111), grazie";
    expect(slices(text, candidateSpans.cards(text))).toContain(
      "4111111111111111"
    );
  });

  it("does not join groups across punctuation or a newline", () => {
    const text = "4111, 1111 1111\n1111";
    expect(slices(text, candidateSpans.cards(text))).not.toContain(
      "4111, 1111 1111\n1111"
    );
  });

  it("does not extract an ASCII candidate embedded inside a Unicode word", () => {
    const text = "èU1T86I309Cé";
    expect(slices(text, candidateSpans.licenses(text))).not.toContain(
      "U1T86I309C"
    );
  });

  it("visits each email block once even if it contains many at-signs", () => {
    const text = "x@x@x@x qa@example.com";
    expect(slices(text, candidateSpans.email(text))).toEqual([
      "x@x@x@x",
      "qa@example.com",
    ]);
  });

  it("keeps UTF-16 offsets and exact slices around supplementary characters", () => {
    const text = "😀 qa@example.com · U1T86I309C · 4111111111111111";
    for (const spans of [
      candidateSpans.email(text),
      candidateSpans.licenses(text),
      candidateSpans.cards(text),
    ]) {
      for (const [start, end] of spans) {
        expect(start).toBe(text.indexOf(text.slice(start, end)));
        expect(text.slice(start, end)).toBeTruthy();
      }
    }
    expect(Array.from(candidateSpans.email(text))).toContainEqual([3, 17]);
  });

  it("does not repeatedly scan a large block of at-signs", () => {
    const text = `pre ${"@".repeat(20000)} post qa@example.com`;
    expect(slices(text, candidateSpans.email(text))).toEqual([
      "qa@example.com",
    ]);
  });

  it("segments long numeric text a bounded number of times", () => {
    const text = "4111111111111111, ".repeat(4000);
    const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
    try {
      expect(Array.from(candidateSpans.cards(text))).toHaveLength(4000);
      expect(segment.mock.calls.length).toBeLessThan(5);
    } finally {
      segment.mockRestore();
    }
  });

  it("does not emit a valid card prefix within a longer grouped run", () => {
    const text = "4111 1111 1111 1111 2222";
    expect(slices(text, candidateSpans.cards(text))).not.toContain(
      "4111 1111 1111 1111"
    );
  });

  it("does not accept a prefix of a longer grouped IBAN", () => {
    const text = "IT60 X054 2811 1010 0000 0123 4567";
    expect(slices(text, candidateSpans.iban(text))).not.toContain(
      "IT60 X054 2811 1010 0000 0123 456"
    );
  });
});
