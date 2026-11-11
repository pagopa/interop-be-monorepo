import { ContactDB } from "pagopa-interop-contact-data-db-models";
import { describe, expect, it } from "vitest";

import { deleteContactsPastProtectionPeriod } from "../src/contactDeletion.js";
import { getProtectionCutoff } from "../src/contactScanner.js";
import { addContacts, addMilliseconds, db, getContactIds } from "./utils.js";

const cutoff = getProtectionCutoff(new Date("2026-11-02T03:00:00.000Z"), 168);
const pastProtection = addMilliseconds(cutoff, -1);

const addContactsPastProtection = (
  count: number
): Promise<Array<ContactDB["id"]>> =>
  addContacts(Array.from({ length: count }, () => pastProtection));

describe("deleteContactsPastProtectionPeriod", () => {
  it("deletes only the given contacts", async () => {
    const [deletedId, keptId] = await addContactsPastProtection(2);

    const deleted = await deleteContactsPastProtectionPeriod(db, {
      cutoff,
      ids: [deletedId],
    });

    expect(deleted).toEqual([deletedId]);
    expect(await getContactIds()).toEqual([keptId]);
  });

  it("never deletes contacts still in their protection period", async () => {
    const ids = await addContacts([cutoff, addMilliseconds(cutoff, 1)]);

    const deleted = await deleteContactsPastProtectionPeriod(db, {
      cutoff,
      ids,
    });

    expect(deleted).toEqual([]);
    expect(new Set(await getContactIds())).toEqual(new Set(ids));
  });

  it("ignores contacts already deleted", async () => {
    const [remainingId, alreadyDeletedId] = await addContactsPastProtection(2);
    await deleteContactsPastProtectionPeriod(db, {
      cutoff,
      ids: [alreadyDeletedId],
    });

    const deleted = await deleteContactsPastProtectionPeriod(db, {
      cutoff,
      ids: [remainingId, alreadyDeletedId],
    });

    expect(deleted).toEqual([remainingId]);
    expect(await getContactIds()).toEqual([]);
  });
});
