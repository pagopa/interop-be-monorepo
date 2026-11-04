import { ContactDataDBConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const ContactDataCleanerConfig = ContactDataDBConfig.and(
  z
    .object({
      // The job must not run without a validated period.
      CONTACT_PROTECTION_PERIOD_HOURS: z.coerce.number().int().positive(),
      CONTACT_SCAN_PAGE_SIZE: z.coerce
        .number()
        .int()
        .positive()
        .max(1000)
        .default(500),
      // Off by default: when off, the job only counts the orphan contacts.
      CONTACT_DELETION_ENABLED: z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .default("false"),
    })
    .transform((config) => ({
      contactProtectionPeriodHours: config.CONTACT_PROTECTION_PERIOD_HOURS,
      contactScanPageSize: config.CONTACT_SCAN_PAGE_SIZE,
      contactDeletionEnabled: config.CONTACT_DELETION_ENABLED,
    }))
);

export type ContactDataCleanerConfig = z.infer<typeof ContactDataCleanerConfig>;

export const config: ContactDataCleanerConfig = ContactDataCleanerConfig.parse(
  process.env
);
