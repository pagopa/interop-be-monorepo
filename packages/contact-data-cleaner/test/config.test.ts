import { describe, expect, it } from "vitest";

import { ContactDataCleanerConfig } from "../src/config/config.js";

describe("ContactDataCleanerConfig", () => {
  it.each([undefined, "", "0", "-1", "1.5", "abc"])(
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

  it.each(["", "TRUE", "1", "yes"])(
    "refuses to start with deletion flag %j",
    (deletionEnabled) => {
      expect(
        ContactDataCleanerConfig.safeParse({
          CONTACT_PROTECTION_PERIOD_HOURS: "168",
          CONTACT_DELETION_ENABLED: deletionEnabled,
        }).success
      ).toBe(false);
    }
  );

  it("reads the protection period and defaults page size and deletion flag", () => {
    expect(
      ContactDataCleanerConfig.parse({ CONTACT_PROTECTION_PERIOD_HOURS: "168" })
    ).toMatchObject({
      contactProtectionPeriodHours: 168,
      contactScanPageSize: 500,
      contactDeletionEnabled: false,
    });
  });

  it("enables the deletion only when explicitly set to true", () => {
    expect(
      ContactDataCleanerConfig.parse({
        CONTACT_PROTECTION_PERIOD_HOURS: "168",
        CONTACT_DELETION_ENABLED: "true",
      })
    ).toMatchObject({ contactDeletionEnabled: true });
  });
});
