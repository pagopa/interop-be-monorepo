import { Logger } from "pagopa-interop-commons";
import { ContactDB } from "pagopa-interop-contact-data-db-models";

import { deleteContactsPastProtectionPeriod } from "./contactDeletion.js";
import { ContactReferenceChecker } from "./contactReferenceChecker.js";
import {
  ContactDataDB,
  getProtectionCutoff,
  scanContactIdsPastProtectionPeriod,
} from "./contactScanner.js";
import { describeError } from "./utilities/errors.js";

interface ContactDataCleanerResult {
  cutoff: Date;
  scannedContacts: number;
  verifiedContacts: number;
  orphanContacts: number;
  deletedContacts: number;
  failedContacts: number;
}

interface CleanerContext {
  cutoff: Date;
  db: ContactDataDB;
  deletionEnabled: boolean;
  logger: Logger;
  referenceChecker: ContactReferenceChecker;
}

interface PageOutcome {
  verified: number;
  orphans: number;
  deleted: number;
  failed: number;
}

const formatCounts = (result: ContactDataCleanerResult): string =>
  `${result.scannedContacts} scanned, ${result.verifiedContacts} verified, ${result.orphanContacts} orphans, ${result.deletedContacts} deleted, ${result.failedContacts} failed`;

// The lookup may return IDs in another textual form (e.g. upper case).
const normalizeContactId = (id: string): string => id.trim().toLowerCase();

/**
 * Returns the contacts of the page that no tenant references. An inconsistent
 * lookup result (IDs outside the page) is rejected, so that it can never turn
 * a referenced contact into an orphan.
 */
const findOrphanIds = async (
  ids: Array<ContactDB["id"]>,
  referenceChecker: ContactReferenceChecker
): Promise<Array<ContactDB["id"]>> => {
  const pageIds = new Set(ids.map(normalizeContactId));
  const lookup = await referenceChecker.findReferencedContactIds(ids);
  const referencedIds = new Set(Array.from(lookup, normalizeContactId));
  if (Array.from(referencedIds).some((id) => !pageIds.has(id))) {
    throw new Error("Reference lookup returned contact IDs outside the page");
  }
  return ids.filter((id) => !referencedIds.has(normalizeContactId(id)));
};

/**
 * The reference lookup and the deletion are not atomic. This is safe because
 * contact IDs are never reused: past its protection period, which covers the
 * propagation of a new association to the readmodel, a contact that is not
 * referenced (failed association or replacement) is never associated again.
 * Contacts whose references cannot be verified or whose deletion fails are
 * preserved, counted as failed and retried by the next run.
 */
const cleanPage = async (
  ids: Array<ContactDB["id"]>,
  { cutoff, db, deletionEnabled, logger, referenceChecker }: CleanerContext
): Promise<PageOutcome> => {
  let orphanIds: Array<ContactDB["id"]>;
  try {
    orphanIds = await findOrphanIds(ids, referenceChecker);
  } catch (error) {
    logger.error(
      `Preserving ${ids.length} contacts whose references could not be verified: ${describeError(error)}`
    );
    return { verified: 0, orphans: 0, deleted: 0, failed: ids.length };
  }

  const verification = { verified: ids.length, orphans: orphanIds.length };
  if (!deletionEnabled || orphanIds.length === 0) {
    return { ...verification, deleted: 0, failed: 0 };
  }

  try {
    const deleted = await deleteContactsPastProtectionPeriod(db, {
      cutoff,
      ids: orphanIds,
    });
    return { ...verification, deleted, failed: 0 };
  } catch (error) {
    logger.error(
      `Failed to delete ${orphanIds.length} orphan contacts: ${describeError(error)}`
    );
    return { ...verification, deleted: 0, failed: orphanIds.length };
  }
};

export const runContactDataCleaner = async ({
  db,
  deletionEnabled,
  logger,
  now,
  pageSize,
  protectionPeriodHours,
  referenceChecker,
}: {
  db: ContactDataDB;
  deletionEnabled: boolean;
  logger: Logger;
  now: Date;
  pageSize: number;
  protectionPeriodHours: number;
  referenceChecker: ContactReferenceChecker;
}): Promise<ContactDataCleanerResult> => {
  const cutoff = getProtectionCutoff(now, protectionPeriodHours);
  logger.info(
    `Scanning contacts created before ${cutoff.toISOString()} (protection period: ${protectionPeriodHours} hours, deletion ${deletionEnabled ? "enabled" : "disabled"})`
  );

  const context: CleanerContext = {
    cutoff,
    db,
    deletionEnabled,
    logger,
    referenceChecker,
  };
  const result: ContactDataCleanerResult = {
    cutoff,
    scannedContacts: 0,
    verifiedContacts: 0,
    orphanContacts: 0,
    deletedContacts: 0,
    failedContacts: 0,
  };
  try {
    for await (const ids of scanContactIdsPastProtectionPeriod(db, {
      cutoff,
      pageSize,
    })) {
      const page = await cleanPage(ids, context);
      result.scannedContacts += ids.length;
      result.verifiedContacts += page.verified;
      result.orphanContacts += page.orphans;
      result.deletedContacts += page.deleted;
      result.failedContacts += page.failed;
    }
  } catch (error) {
    // Record what the pages already processed did before failing.
    logger.error(`Contact data cleaner interrupted: ${formatCounts(result)}`);
    throw error;
  }

  logger.info(`Contact data cleaner completed: ${formatCounts(result)}`);

  return result;
};
