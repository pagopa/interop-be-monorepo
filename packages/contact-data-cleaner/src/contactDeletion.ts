import { and, inArray, lt } from "drizzle-orm";
import { contact, ContactDB } from "pagopa-interop-contact-data-db-models";

import { ContactDataDB } from "./contactScanner.js";

/**
 * Deletes the given contacts and returns the IDs actually deleted; contacts
 * already absent are ignored. The cutoff is checked again only as a safeguard
 * against callers passing contacts still in their protection period.
 */
export const deleteContactsPastProtectionPeriod = async (
  db: ContactDataDB,
  { cutoff, ids }: { cutoff: Date; ids: Array<ContactDB["id"]> }
): Promise<Array<ContactDB["id"]>> => {
  const deleted = await db
    .delete(contact)
    .where(
      and(inArray(contact.id, ids), lt(contact.createdAt, cutoff.toISOString()))
    )
    .returning({ id: contact.id });

  return deleted.map(({ id }) => id);
};
