import { Logger } from "pagopa-interop-commons";

import {
  ContactDataDB,
  getProtectionCutoff,
  scanContactIdsPastProtectionPeriod,
} from "./contactScanner.js";

export interface ContactDataCleanerResult {
  cutoff: Date;
  scannedContacts: number;
  scannedPages: number;
}

export const runContactDataCleaner = async ({
  db,
  logger,
  now,
  pageSize,
  protectionPeriodHours,
}: {
  db: ContactDataDB;
  logger: Logger;
  now: Date;
  pageSize: number;
  protectionPeriodHours: number;
}): Promise<ContactDataCleanerResult> => {
  const cutoff = getProtectionCutoff(now, protectionPeriodHours);
  logger.info(
    `Scanning contacts created before ${cutoff.toISOString()} (protection period: ${protectionPeriodHours} hours)`
  );

  let scannedPages = 0;
  let scannedContacts = 0;
  for await (const ids of scanContactIdsPastProtectionPeriod(db, {
    cutoff,
    pageSize,
  })) {
    scannedPages += 1;
    scannedContacts += ids.length;
  }

  logger.info(
    `Scanned ${scannedContacts} contacts past the protection period in ${scannedPages} pages`
  );

  return { cutoff, scannedContacts, scannedPages };
};
