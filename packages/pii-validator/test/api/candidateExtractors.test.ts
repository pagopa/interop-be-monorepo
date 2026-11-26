import moo from "moo";
import { describe, expect, it, vi } from "vitest";

import {
  Candidate,
  extractEmailCandidates,
  extractAlphanumericCandidates,
  extractNumericCandidates,
} from "../../src/services/candidateExtractors.js";

const extractors = {
  email: extractEmailCandidates,
  numeric: extractNumericCandidates,
  alphanumeric: extractAlphanumericCandidates,
};

function slices(_text: string, spans: Iterable<Candidate>) {
  return Array.from(spans, ({ text: candidateText }) => candidateText);
}

describe("bounded candidate spans", () => {
  it("keeps contiguous Unicode letters, marks and numbers in one candidate", () => {
    const source =
      "漢CA12345AA CA12345AA漢 𐐀U1B123456C a\u0301IT60X0542811101000000123456 ١٢abc";
    const values = Array.from(extractAlphanumericCandidates(source));
    expect(values.map(({ text }) => text)).toEqual(source.split(" "));
    for (const { text, start, end } of values)
      expect(source.slice(start, end)).toBe(text);
  });

  it("extracts whole alphanumeric tokens without document-specific restrictions", () => {
    const source =
      "😀 (CA12345AA), U1B123456C IT60X0542811101000000123456 generic42";
    const values = Array.from(extractAlphanumericCandidates(source));
    expect(values.map(({ text }) => text)).toEqual([
      "CA12345AA",
      "U1B123456C",
      "IT60X0542811101000000123456",
      "generic42",
    ]);
    for (const { text, start, end } of values) {
      expect(source.slice(start, end)).toBe(text);
      expect(start).toBe(source.indexOf(text));
    }
  });

  it.each(["éCA12345AA", "CA12345AAΩ", "CA12345AA_foo", "CA12345AA\u0301"])(
    "does not recover a document from a larger Unicode identifier: %s",
    (source) => {
      expect(
        Array.from(extractAlphanumericCandidates(source)).map(
          ({ text }) => text
        )
      ).not.toContain("CA12345AA");
    }
  );

  it("keeps generic alphanumeric runs whole and lexer iterations independent", () => {
    const source = "x".repeat(20000) + "CA12345AA";
    expect(Array.from(extractAlphanumericCandidates(source))).toEqual([
      { text: source, start: 0, end: source.length },
    ]);
    const first = extractAlphanumericCandidates("CA12345AA U1B123456C")[
      Symbol.iterator
    ]();
    const second = extractAlphanumericCandidates("other42")[Symbol.iterator]();
    expect(first.next().value?.text).toBe("CA12345AA");
    expect(second.next().value?.text).toBe("other42");
    expect(first.next().value?.text).toBe("U1B123456C");
    expect(second.next().done).toBe(true);
  });
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
      Array.from(extractors.email(text));
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
  it("lets Moo emit the whole email-like block including edge punctuation", () => {
    const text = "Scrivi a qa@example.com, grazie";
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
      expect(slices(text, extractors.email(text))).toContain("qa@example.com");
      expect(tokens).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "emailCandidate",
            text: "qa@example.com,",
            offset: text.indexOf("qa@example.com"),
          }),
        ])
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("preserves original offsets for compact card candidates", () => {
    const text = "carta (4111111111111111), grazie";
    expect(slices(text, extractors.numeric(text))).toContain(
      "4111111111111111"
    );
  });

  it.each([
    ["numeric", "numericCandidate", "12345678901"],
    ["alphanumeric", "alphanumericCandidate", "IT60X0542811101000000123456"],
    ["numeric", "numericCandidate", "4111111111111111"],
    ["numeric", "numericCandidate", "+39 3494096457"],
  ] as const)("lets Moo emit a whole %s candidate", (category, type, value) => {
    const text = `prova (${value}), fine`;
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
      expect(slices(text, extractors[category](text))).toContain(value);
      expect(tokens).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type,
            text: value,
            offset: text.indexOf(value),
          }),
        ])
      );
    } finally {
      spy.mockRestore();
    }
  });

  it.each([
    ["numeric", "IT123 456 78901"],
    ["numeric", "4111 1111 1111 1111"],
    ["numeric", "+39  349 409 6457"],
  ] as const)("preserves the whole spaced %s span", (category, value) => {
    const text = `😀 (${value}), fine`;
    const start = text.indexOf(value);
    expect(Array.from(extractors[category](text))).toEqual([
      { text: value, start, end: start + value.length },
    ]);
  });

  it.each([
    ["numeric", "4111111111111111"],
    ["numeric", "12345678901"],
    ["alphanumeric", "IT60X0542811101000000123456"],
  ] as const)(
    "keeps %s boundaries across ASCII and Unicode adjacency",
    (category, value) => {
      for (const adjacent of ["a", "Z", "0", "9", "é", "Ω"]) {
        expect(
          slices(
            `${adjacent}${value}`,
            extractors[category](`${adjacent}${value}`)
          )
        ).not.toContain(value);
        expect(
          slices(
            `${value}${adjacent}`,
            extractors[category](`${value}${adjacent}`)
          )
        ).not.toContain(value);
      }
    }
  );

  it("does not join groups across punctuation or a newline", () => {
    const text = "4111, 1111 1111\n1111";
    expect(slices(text, extractors.numeric(text))).not.toContain(
      "4111, 1111 1111\n1111"
    );
  });

  it("visits each email block once even if it contains many at-signs", () => {
    const text = "x@x@x@x qa@example.com";
    expect(slices(text, extractors.email(text))).toEqual([
      "x@x@x@x",
      "qa@example.com",
    ]);
  });

  it("keeps UTF-16 offsets and exact slices around supplementary characters", () => {
    const text = "😀 qa@example.com · U1T86I309C · 4111111111111111";
    for (const spans of [extractors.email(text), extractors.numeric(text)]) {
      for (const { start, end, text: candidateText } of spans) {
        expect(start).toBe(text.indexOf(text.slice(start, end)));
        expect(text.slice(start, end)).toBe(candidateText);
      }
    }
    expect(Array.from(extractors.email(text))).toContainEqual({
      text: "qa@example.com",
      start: 3,
      end: 17,
    });
  });

  it("does not repeatedly scan a large block of at-signs", () => {
    const text = `pre ${"@".repeat(20000)} post qa@example.com`;
    expect(slices(text, extractors.email(text))).toEqual(["qa@example.com"]);
  });

  it("segments long numeric text a bounded number of times", () => {
    const text = "4111111111111111, ".repeat(4000);
    const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
    try {
      expect(Array.from(extractors.numeric(text))).toHaveLength(4000);
      expect(segment.mock.calls.length).toBeLessThan(5);
    } finally {
      segment.mockRestore();
    }
  });

  it("does not emit a valid card prefix within a longer grouped run", () => {
    const text = "4111 1111 1111 1111 2222";
    expect(slices(text, extractors.numeric(text))).not.toContain(
      "4111 1111 1111 1111"
    );
  });

  it("does not accept a prefix of a longer grouped IBAN", () => {
    const text = "IT60 X054 2811 1010 0000 0123 4567";
    expect(slices(text, extractors.alphanumeric(text))).not.toContain(
      "IT60 X054 2811 1010 0000 0123 456"
    );
  });
  it("isolates interleaved lexer invocations and skips neutral fallback", () => {
    const first = extractNumericCandidates("4111111111111111, 3494096457")[
      Symbol.iterator
    ]();
    const second = extractNumericCandidates("IT12345678901")[Symbol.iterator]();
    expect(first.next().value?.text).toBe("4111111111111111");
    expect(second.next().value?.text).toBe("IT12345678901");
    expect(first.next().value?.text).toBe("3494096457");
    expect(second.next().done).toBe(true);
    expect(first.next().done).toBe(true);
    expect(Array.from(extractNumericCandidates("testo neutro"))).toEqual([]);
  });
});
