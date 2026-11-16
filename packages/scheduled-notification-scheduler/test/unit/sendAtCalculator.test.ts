import { describe, it, expect } from "vitest";

import { computeSendAt } from "../../src/services/sendAtCalculator.js";

describe("computeSendAt", () => {
  const tz = "Europe/Rome";
  const sendAtHour = 9;

  it("returns 09:00 Europe/Rome (07:00 UTC) when archivableOn is mid-summer (CEST)", () => {
    // archivableOn = 1 Aug 2026 00:00 UTC (CEST, UTC+2)
    const archivableOn = new Date("2026-08-01T00:00:00Z");
    // 7 days before = 25 Jul 2026 09:00 Europe/Rome = 07:00 UTC
    const sendAt = computeSendAt({
      archivableOn,
      daysBeforeArchive: 7,
      sendAtHour,
      tz,
    });
    expect(sendAt.toISOString()).toBe("2026-07-25T07:00:00.000Z");
  });

  it("returns 09:00 Europe/Rome (08:00 UTC) when archivableOn is mid-winter (CET)", () => {
    // archivableOn = 1 Feb 2027 00:00 UTC (CET, UTC+1)
    const archivableOn = new Date("2027-02-01T00:00:00Z");
    // 3 days before = 29 Jan 2027 09:00 Europe/Rome = 08:00 UTC
    const sendAt = computeSendAt({
      archivableOn,
      daysBeforeArchive: 3,
      sendAtHour,
      tz,
    });
    expect(sendAt.toISOString()).toBe("2027-01-29T08:00:00.000Z");
  });

  it("handles DST forward boundary (last Sunday of March)", () => {
    // archivableOn = 30 Mar 2026 00:00 UTC
    // 1 day before = 29 Mar 2026 (DST forward day in Europe/Rome)
    // At 09:00 in Rome on that day we are already in CEST (UTC+2) -> 07:00 UTC
    const archivableOn = new Date("2026-03-30T00:00:00Z");
    const sendAt = computeSendAt({
      archivableOn,
      daysBeforeArchive: 1,
      sendAtHour,
      tz,
    });
    expect(sendAt.toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  it("handles DST backward boundary (last Sunday of October)", () => {
    // archivableOn = 26 Oct 2026 00:00 UTC
    // 1 day before = 25 Oct 2026 (DST backward day in Europe/Rome)
    // At 09:00 in Rome on that day we are already back in CET (UTC+1) -> 08:00 UTC
    const archivableOn = new Date("2026-10-26T00:00:00Z");
    const sendAt = computeSendAt({
      archivableOn,
      daysBeforeArchive: 1,
      sendAtHour,
      tz,
    });
    expect(sendAt.toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  it("is deterministic for the same inputs (no `now()` dependency)", () => {
    const archivableOn = new Date("2026-08-01T00:00:00Z");
    const a = computeSendAt({
      archivableOn,
      daysBeforeArchive: 7,
      sendAtHour,
      tz,
    });
    const b = computeSendAt({
      archivableOn,
      daysBeforeArchive: 7,
      sendAtHour,
      tz,
    });
    expect(a.toISOString()).toBe(b.toISOString());
  });
});
