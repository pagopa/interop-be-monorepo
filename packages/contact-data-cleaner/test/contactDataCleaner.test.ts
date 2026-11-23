import { logger } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";

import { runContactDataCleaner } from "../src/contactDataCleaner.js";
import { addContacts, db, TEST_EMAIL_DOMAIN } from "./utils.js";

describe("runContactDataCleaner", () => {
  it("scans the contacts past the protection period without logging emails", async () => {
    await addContacts([
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2026-10-26T02:59:59.999Z"),
      new Date("2026-10-26T03:00:00.000Z"),
      new Date("2026-11-01T00:00:00.000Z"),
    ]);
    const loggerInstance = logger({ serviceName: "contact-data-cleaner" });
    const info = vi.spyOn(loggerInstance, "info");

    const result = await runContactDataCleaner({
      db,
      logger: loggerInstance,
      now: new Date("2026-11-02T03:00:00.000Z"),
      pageSize: 1,
      protectionPeriodHours: 168,
    });

    expect(result).toEqual({
      cutoff: new Date("2026-10-26T03:00:00.000Z"),
      scannedContacts: 2,
      scannedPages: 2,
    });
    expect(info).toHaveBeenLastCalledWith(
      "Scanned 2 contacts past the protection period in 2 pages"
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain(TEST_EMAIL_DOMAIN);
  });
});
