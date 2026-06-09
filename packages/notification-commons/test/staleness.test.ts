import { describe, expect, it } from "vitest";
import { isStale } from "../src/scheduled/staleness.js";

const hours = (n: number): number => n * 60 * 60 * 1000;

describe("isStale", () => {
  const now = new Date("2026-06-04T12:00:00.000Z");

  it("returns false when sendAt is exactly at the threshold boundary", () => {
    const sendAt = new Date(now.getTime() - hours(24));
    expect(isStale(sendAt, 24, now)).toBe(false);
  });

  it("returns true when sendAt is strictly older than the threshold", () => {
    const sendAt = new Date(now.getTime() - hours(25));
    expect(isStale(sendAt, 24, now)).toBe(true);
  });

  it("returns false for sendAt in the future", () => {
    const sendAt = new Date(now.getTime() + hours(1));
    expect(isStale(sendAt, 24, now)).toBe(false);
  });

  it("returns false for sendAt at now", () => {
    expect(isStale(now, 24, now)).toBe(false);
  });

  it("respects a zero threshold (any age >0h is stale)", () => {
    const olderByOneMinute = new Date(now.getTime() - 60 * 1000);
    expect(isStale(olderByOneMinute, 0, now)).toBe(false);
    const olderByOneHour = new Date(now.getTime() - hours(1));
    expect(isStale(olderByOneHour, 0, now)).toBe(true);
  });
});
