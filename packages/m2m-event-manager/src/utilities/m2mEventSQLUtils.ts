import { Column, SQL, gt } from "drizzle-orm";

export function afterEventIdFilter(
  column: Column,
  lastEventId: string | undefined
): SQL | undefined {
  return lastEventId ? gt(column, lastEventId) : undefined;
  // ^ event ID is a UUIDv7, lexicographical order is the same as chronological order
}
