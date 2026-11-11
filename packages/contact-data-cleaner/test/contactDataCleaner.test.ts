import { DrizzleQueryError, eq } from "drizzle-orm";
import { logger } from "pagopa-interop-commons";
import { contact, ContactDB } from "pagopa-interop-contact-data-db-models";
import { generateId } from "pagopa-interop-models";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ContactDataCleanerResult,
  runContactDataCleaner,
} from "../src/contactDataCleaner.js";
import { ContactReferenceChecker } from "../src/contactReferenceChecker.js";
import { getProtectionCutoff } from "../src/contactScanner.js";
import {
  addContacts,
  addMilliseconds,
  db,
  getContactIds,
  TEST_EMAIL_DOMAIN,
} from "./utils.js";

type ContactId = ContactDB["id"];

const now = new Date("2026-11-02T03:00:00.000Z");
const cutoff = getProtectionCutoff(now, 168);
const pastProtection = addMilliseconds(cutoff, -1);
const loggerInstance = logger({ serviceName: "contact-data-cleaner" });

const addContactsPastProtection = (count: number): Promise<ContactId[]> =>
  addContacts(Array.from({ length: count }, () => pastProtection));

const referenceCheckerFor = (
  referencedIds: ContactId[]
): ContactReferenceChecker => ({
  findReferencedContactIds: vi.fn((ids: ContactId[]) =>
    Promise.resolve(new Set(ids.filter((id) => referencedIds.includes(id))))
  ),
});

const runCleaner = (
  referenceChecker: ContactReferenceChecker | undefined,
  { deletionEnabled = true, pageSize = 10 } = {}
): Promise<ContactDataCleanerResult> =>
  runContactDataCleaner({
    db,
    deletionEnabled,
    logger: loggerInstance,
    now,
    pageSize,
    protectionPeriodHours: 168,
    referenceChecker,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runContactDataCleaner", () => {
  it("deletes the orphans past the protection period and preserves the other contacts", async () => {
    const [referencedId] = await addContactsPastProtection(3);
    const protectedIds = await addContacts([cutoff, now]);
    const referenceChecker = referenceCheckerFor([referencedId]);
    const info = vi.spyOn(loggerInstance, "info");

    const result = await runCleaner(referenceChecker, { pageSize: 2 });

    expect(result).toEqual({
      cutoff,
      scannedContacts: 3,
      verifiedContacts: 3,
      orphanContacts: 2,
      deletedContacts: 2,
      failedContacts: 0,
    });
    expect(new Set(await getContactIds())).toEqual(
      new Set([referencedId, ...protectedIds])
    );
    // One lookup per page, not per contact.
    expect(referenceChecker.findReferencedContactIds).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenLastCalledWith(
      "Contact data cleaner completed: 3 scanned, 3 verified, 2 orphans, 2 deleted, 0 failed"
    );
  });

  it("logs the IDs of the deleted contacts", async () => {
    const [referencedId, ...orphanIds] = await addContactsPastProtection(3);
    const info = vi.spyOn(loggerInstance, "info");

    await runCleaner(referenceCheckerFor([referencedId]));

    const deletionLog = info.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.startsWith("Deleted "));
    expect(deletionLog).toMatch(/^Deleted 2 orphan contacts: /);
    orphanIds.forEach((id) => expect(deletionLog).toContain(id));
    expect(deletionLog).not.toContain(referencedId);
  });

  it("only counts the orphans when deletion is disabled", async () => {
    const ids = await addContactsPastProtection(2);

    const result = await runCleaner(referenceCheckerFor([]), {
      deletionEnabled: false,
    });

    expect(result).toMatchObject({
      verifiedContacts: 2,
      orphanContacts: 2,
      deletedContacts: 0,
      failedContacts: 0,
    });
    expect(new Set(await getContactIds())).toEqual(new Set(ids));
  });

  it("preserves the contacts whose references cannot be verified and goes on with the next pages", async () => {
    await addContactsPastProtection(3);
    const findReferencedContactIds = vi
      .fn<ContactReferenceChecker["findReferencedContactIds"]>()
      .mockRejectedValueOnce(new Error("readmodel unavailable"))
      .mockResolvedValue(new Set<ContactId>());
    const error = vi.spyOn(loggerInstance, "error");

    const result = await runCleaner(
      { findReferencedContactIds },
      { pageSize: 2 }
    );

    expect(result).toMatchObject({
      scannedContacts: 3,
      verifiedContacts: 1,
      orphanContacts: 1,
      deletedContacts: 1,
      failedContacts: 2,
    });
    expect(new Set(await getContactIds())).toEqual(
      new Set(findReferencedContactIds.mock.calls[0][0])
    );
    expect(error).toHaveBeenCalledWith(
      "Preserving 2 contacts whose references could not be verified: readmodel unavailable"
    );
  });

  it("skips the run without reading the contacts while references cannot be verified, then deletes the orphans in a later run", async () => {
    await addContactsPastProtection(2);
    const select = vi.spyOn(db, "select");
    const warn = vi.spyOn(loggerInstance, "warn");

    const skippedRun = await runCleaner(undefined);

    expect(skippedRun).toEqual({
      cutoff,
      scannedContacts: 0,
      verifiedContacts: 0,
      orphanContacts: 0,
      deletedContacts: 0,
      failedContacts: 0,
    });
    expect(select).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(await getContactIds()).toHaveLength(2);

    const laterRun = await runCleaner(referenceCheckerFor([]));

    expect(laterRun).toMatchObject({ deletedContacts: 2, failedContacts: 0 });
    expect(await getContactIds()).toEqual([]);
  });

  it("preserves the orphans whose deletion fails, logging only the cause", async () => {
    const ids = await addContactsPastProtection(2);
    vi.spyOn(db, "delete").mockImplementationOnce(() => {
      throw new DrizzleQueryError(
        "delete from contact_data.contact",
        ids,
        new Error("delete failed")
      );
    });
    const error = vi.spyOn(loggerInstance, "error");

    const result = await runCleaner(referenceCheckerFor([]));

    expect(result).toMatchObject({
      verifiedContacts: 2,
      orphanContacts: 2,
      deletedContacts: 0,
      failedContacts: 2,
    });
    expect(new Set(await getContactIds())).toEqual(new Set(ids));
    expect(error).toHaveBeenCalledWith(
      "Failed to delete 2 orphan contacts: delete failed"
    );
  });

  it("tolerates contacts deleted while the run is in progress", async () => {
    const [deletedMeanwhileId] = await addContactsPastProtection(2);
    const referenceChecker: ContactReferenceChecker = {
      findReferencedContactIds: async () => {
        await db.delete(contact).where(eq(contact.id, deletedMeanwhileId));
        return new Set<ContactId>();
      },
    };

    const result = await runCleaner(referenceChecker);

    expect(result).toMatchObject({
      orphanContacts: 2,
      deletedContacts: 1,
      failedContacts: 0,
    });
    expect(await getContactIds()).toEqual([]);
  });

  it("matches the referenced IDs regardless of their case", async () => {
    const [referencedId] = await addContactsPastProtection(2);
    const referenceChecker: ContactReferenceChecker = {
      findReferencedContactIds: () =>
        Promise.resolve(new Set([referencedId.toUpperCase()])),
    };

    const result = await runCleaner(referenceChecker);

    expect(result).toMatchObject({ orphanContacts: 1, deletedContacts: 1 });
    expect(await getContactIds()).toEqual([referencedId]);
  });

  it("preserves the page when the reference lookup returns IDs outside it", async () => {
    const ids = await addContactsPastProtection(2);
    const referenceChecker: ContactReferenceChecker = {
      findReferencedContactIds: () => Promise.resolve(new Set([generateId()])),
    };
    const error = vi.spyOn(loggerInstance, "error");

    const result = await runCleaner(referenceChecker);

    expect(result).toMatchObject({
      verifiedContacts: 0,
      deletedContacts: 0,
      failedContacts: 2,
    });
    expect(new Set(await getContactIds())).toEqual(new Set(ids));
    expect(error).toHaveBeenCalledWith(
      "Preserving 2 contacts whose references could not be verified: Reference lookup returned contact IDs outside the page"
    );
  });

  it("fails when the contacts cannot be read, logging the counts reached so far", async () => {
    await addContactsPastProtection(3);
    const select = db.select.bind(db);
    vi.spyOn(db, "select")
      .mockImplementationOnce(select)
      .mockImplementationOnce(() => {
        throw new Error("read failed");
      });
    const error = vi.spyOn(loggerInstance, "error");

    const run = runCleaner(referenceCheckerFor([]), { pageSize: 2 });

    await expect(run).rejects.toThrow("read failed");
    expect(error).toHaveBeenCalledWith(
      "Contact data cleaner interrupted: 2 scanned, 2 verified, 2 orphans, 2 deleted, 0 failed"
    );
  });

  it("never logs emails", async () => {
    await addContactsPastProtection(3);
    const logs = [
      vi.spyOn(loggerInstance, "info"),
      vi.spyOn(loggerInstance, "warn"),
      vi.spyOn(loggerInstance, "error"),
    ];

    const unavailableReferenceChecker: ContactReferenceChecker = {
      findReferencedContactIds: () =>
        Promise.reject(new Error("readmodel unavailable")),
    };

    await runCleaner(undefined);
    await runCleaner(unavailableReferenceChecker, { pageSize: 2 });
    await runCleaner(referenceCheckerFor([]));

    expect(JSON.stringify(logs.map((log) => log.mock.calls))).not.toContain(
      TEST_EMAIL_DOMAIN
    );
  });
});
