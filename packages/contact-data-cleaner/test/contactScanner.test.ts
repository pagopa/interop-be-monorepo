import { inArray } from "drizzle-orm";
import { contact, ContactDB } from "pagopa-interop-contact-data-db-models";
import { describe, expect, it } from "vitest";

import {
  getProtectionCutoff,
  scanContactIdsPastProtectionPeriod,
} from "../src/contactScanner.js";
import { addContacts, addMilliseconds, db } from "./utils.js";

type ContactId = ContactDB["id"];

const runStart = new Date("2026-11-02T03:00:00.000Z");
const cutoff = getProtectionCutoff(runStart, 168);

const creationDatesPastProtectionPeriod = (count: number): Date[] =>
  Array.from({ length: count }, (_, index) =>
    addMilliseconds(cutoff, -(index + 1) * 1000)
  );

const scanPages = async (
  pageSize: number,
  onPage: (ids: ContactId[]) => Promise<void> = async () => undefined
): Promise<ContactId[][]> => {
  const pages: ContactId[][] = [];
  for await (const ids of scanContactIdsPastProtectionPeriod(db, {
    cutoff,
    pageSize,
  })) {
    pages.push(ids);
    await onPage(ids);
  }
  return pages;
};

const deleteContacts = async (ids: ContactId[]): Promise<void> => {
  await db.delete(contact).where(inArray(contact.id, ids));
};

describe("getProtectionCutoff", () => {
  it("subtracts the protection period from the run start", () => {
    expect(cutoff).toEqual(new Date("2026-10-26T03:00:00.000Z"));
  });
});

describe("scanContactIdsPastProtectionPeriod", () => {
  it("includes only contacts created strictly before the cutoff", async () => {
    const [pastProtectionId] = await addContacts([addMilliseconds(cutoff, -1)]);
    await addContacts([cutoff, addMilliseconds(cutoff, 1), runStart]);

    expect(await scanPages(10)).toEqual([[pastProtectionId]]);
  });

  it.each([
    { contacts: 7, pageSize: 3, pageLengths: [3, 3, 1] },
    { contacts: 6, pageSize: 3, pageLengths: [3, 3] },
    { contacts: 0, pageSize: 3, pageLengths: [] },
  ])(
    "returns each of $contacts contacts past the protection period once in pages of $pageSize",
    async ({ contacts, pageSize, pageLengths }) => {
      const ids = await addContacts(
        creationDatesPastProtectionPeriod(contacts)
      );

      const pages = await scanPages(pageSize);

      expect(pages.map((page) => page.length)).toEqual(pageLengths);
      expect(pages.flat()).toHaveLength(ids.length);
      expect(new Set(pages.flat())).toEqual(new Set(ids));
    }
  );

  it("excludes contacts created during the scan", async () => {
    const ids = await addContacts(creationDatesPastProtectionPeriod(3));

    const pages = await scanPages(1, async () => {
      await addContacts([runStart]);
    });

    expect(new Set(pages.flat())).toEqual(new Set(ids));
  });

  it("does not skip contacts when the pages already read are deleted", async () => {
    const ids = await addContacts(creationDatesPastProtectionPeriod(5));

    const pages = await scanPages(2, deleteContacts);

    expect(pages.flat()).toHaveLength(ids.length);
    expect(new Set(pages.flat())).toEqual(new Set(ids));
    expect(await db.select().from(contact)).toEqual([]);
  });

  it("starts over and reads the remaining contacts after an interruption", async () => {
    const ids = await addContacts(creationDatesPastProtectionPeriod(5));
    const interruption = new Error("interrupted");
    const processedBeforeInterruption: ContactId[] = [];

    await expect(
      scanPages(2, async (page) => {
        await deleteContacts(page);
        processedBeforeInterruption.push(...page);
        throw interruption;
      })
    ).rejects.toThrow(interruption);

    const pagesAfterRestart = await scanPages(2);

    expect(processedBeforeInterruption).toHaveLength(2);
    expect(pagesAfterRestart.flat()).toHaveLength(3);
    expect(
      new Set([...processedBeforeInterruption, ...pagesAfterRestart.flat()])
    ).toEqual(new Set(ids));
  });

  it.each([0, -1, 1.5])("rejects page size %j", async (pageSize) => {
    await addContacts(creationDatesPastProtectionPeriod(1));

    await expect(scanPages(pageSize)).rejects.toThrow(
      `Invalid contact scan page size: ${pageSize}`
    );
  });
});
