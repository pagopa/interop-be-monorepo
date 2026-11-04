import { and, asc, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { contact, ContactDB } from "pagopa-interop-contact-data-db-models";

export type ContactDataDB = ReturnType<typeof drizzle>;

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export const getProtectionCutoff = (
  now: Date,
  protectionPeriodHours: number
): Date =>
  new Date(now.getTime() - protectionPeriodHours * MILLISECONDS_PER_HOUR);

const readContactIdsPage = async (
  db: ContactDataDB,
  cutoff: Date,
  pageSize: number,
  lastId: ContactDB["id"] | undefined
): Promise<Array<ContactDB["id"]>> => {
  const rows = await db
    .select({ id: contact.id })
    .from(contact)
    .where(
      and(
        lt(contact.createdAt, cutoff.toISOString()),
        lastId === undefined ? undefined : gt(contact.id, lastId)
      )
    )
    .orderBy(asc(contact.id))
    .limit(pageSize);

  return rows.map(({ id }) => id);
};

/**
 * Yields, page by page, the IDs of the contacts created strictly before the
 * cutoff. The cursor is the last ID read (keyset pagination on the primary
 * key): deleting rows already yielded does not shift the following pages, and
 * contacts created during the scan are after the cutoff.
 * No checkpoint is persisted: after an interruption a new run starts over.
 */
export async function* scanContactIdsPastProtectionPeriod(
  db: ContactDataDB,
  { cutoff, pageSize }: { cutoff: Date; pageSize: number }
): AsyncGenerator<Array<ContactDB["id"]>, void, undefined> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`Invalid contact scan page size: ${pageSize}`);
  }

  let lastId: ContactDB["id"] | undefined;
  let hasMorePages = true;

  while (hasMorePages) {
    const ids = await readContactIdsPage(db, cutoff, pageSize, lastId);
    if (ids.length > 0) {
      yield ids;
    }
    hasMorePages = ids.length === pageSize;
    lastId = ids.at(-1);
  }
}
