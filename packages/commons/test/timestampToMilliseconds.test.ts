import { describe, expect, it } from "vitest";

import { timestampToMilliseconds } from "../src/utils/date.js";

describe("timestampToMilliseconds", () => {
  it.each([
    {
      description: "10-digit seconds",
      input: 1754402213,
      expected: 1754402213000,
    },
    {
      description: "9-digit seconds",
      input: 999999999,
      expected: 999999999000,
    },
    { description: "small seconds", input: 1, expected: 1000 },
    { description: "zero", input: 0, expected: 0 },
    {
      description: "top of the seconds range",
      input: 9999999999,
      expected: 9999999999000,
    },
    {
      description: "smallest value out of the seconds range",
      input: 1e10,
      expected: 10000000000,
    },
    {
      description: "seconds with decimals",
      input: 1754402213.123,
      expected: 1754402213123,
    },
    {
      description: "seconds with sub-millisecond decimals",
      input: 1754402213.1237,
      expected: 1754402213124,
    },
    {
      description: "13-digit milliseconds",
      input: 1754402213123,
      expected: 1754402213123,
    },
    {
      description: "milliseconds with decimals",
      input: 1754402213123.7,
      expected: 1754402213124,
    },
    {
      description: "microseconds",
      input: 1754402213123456,
      expected: 1754402213123,
    },
    {
      description: "microseconds with decimals",
      input: 1754402213123456.5,
      expected: 1754402213123,
    },
    {
      description: "nanoseconds",
      input: 1754402213 * 1e9 + 123456789,
      expected: 1754402213123,
    },
    {
      description: "negative seconds (date before 1970)",
      input: -86400,
      expected: -86400000,
    },
    { description: "Infinity", input: Infinity, expected: Infinity },
  ])("converts $description ($input) to $expected", ({ input, expected }) => {
    expect(timestampToMilliseconds(input)).toBe(expected);
  });

  it("returns NaN unchanged", () => {
    expect(Number.isNaN(timestampToMilliseconds(NaN))).toBe(true);
  });

  const epochsInSeconds = [
    Date.UTC(2005, 5, 15),
    Date.UTC(2026, 7, 5),
    Date.UTC(2200, 0, 1),
  ].map((milliseconds) => milliseconds / 1000);

  it.each(epochsInSeconds)(
    "converts the seconds, milliseconds, microseconds and nanoseconds representations of epoch %d to the same milliseconds",
    (seconds) => {
      const expected = seconds * 1000;

      expect(timestampToMilliseconds(seconds)).toBe(expected);
      expect(timestampToMilliseconds(seconds * 1000)).toBe(expected);
      expect(timestampToMilliseconds(seconds * 1e6)).toBe(expected);
      expect(timestampToMilliseconds(seconds * 1e9)).toBe(expected);
    }
  );
});
