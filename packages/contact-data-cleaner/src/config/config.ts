import { ContactDataDBConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const ContactDataCleanerConfig = ContactDataDBConfig.and(
  z
    .object({
      // The job must not run without a validated period. At most one week:
      // orphan contacts must not be kept longer than that.
      CONTACT_PROTECTION_PERIOD_HOURS: z.coerce
        .number()
        .int()
        .positive()
        .max(168),
      CONTACT_SCAN_PAGE_SIZE: z.coerce
        .number()
        .int()
        .positive()
        .max(1000)
        .default(500),
    })
    .transform((config) => ({
      contactProtectionPeriodHours: config.CONTACT_PROTECTION_PERIOD_HOURS,
      contactScanPageSize: config.CONTACT_SCAN_PAGE_SIZE,
    }))
);

export type ContactDataCleanerConfig = z.infer<typeof ContactDataCleanerConfig>;

export const config: ContactDataCleanerConfig = ContactDataCleanerConfig.parse(
  process.env
);
