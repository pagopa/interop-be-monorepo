import { describe, expect, it } from "vitest";

import { ContactDataCleanerConfig } from "../src/config/config.js";

describe("ContactDataCleanerConfig", () => {
  it.each([undefined, "", "0", "-1", "1.5", "169", "abc"])(
    "refuses to start with protection period %j",
    (protectionPeriodHours) => {
      expect(
        ContactDataCleanerConfig.safeParse({
          CONTACT_PROTECTION_PERIOD_HOURS: protectionPeriodHours,
        }).success
      ).toBe(false);
    }
  );

  it.each(["0", "-1", "1.5", "1001", "abc"])(
    "refuses to start with page size %j",
    (pageSize) => {
      expect(
        ContactDataCleanerConfig.safeParse({
          CONTACT_PROTECTION_PERIOD_HOURS: "168",
          CONTACT_SCAN_PAGE_SIZE: pageSize,
        }).success
      ).toBe(false);
    }
  );

  it("reads the protection period and defaults the page size", () => {
    expect(
      ContactDataCleanerConfig.parse({ CONTACT_PROTECTION_PERIOD_HOURS: "168" })
    ).toMatchObject({
      contactProtectionPeriodHours: 168,
      contactScanPageSize: 500,
    });
  });
});
