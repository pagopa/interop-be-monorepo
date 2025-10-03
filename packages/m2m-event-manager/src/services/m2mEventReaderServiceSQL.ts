import { attributeInM2MEvent } from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { AttributeM2MEvent, AttributeM2MEventId } from "pagopa-interop-models";
import { asc } from "drizzle-orm";
import { afterEventIdFilter } from "../utilities/m2mEventSQLUtils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventReaderServiceSQLBuilder(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  /**
   * Event queries in this file MUST order by event ID ascending
   * to ensure user does not miss events.
   *
   * Example (with numerical IDs for simplicity):
   *  - User fetched events up to ID 100.
   *  - 900 more events occurred, latest ID is 1000.
   *  - User requests next events after lastEventId=100, limit=500 (max limit).
   *  - If ordered by descending ID, events from 1000 to 501 would be returned.
   *  - User misses events from 101 to 500, which cannot be fetched again.
   */

  return {
    async getAttributeM2MEvents(
      lastEventId: AttributeM2MEventId | undefined,
      limit: number
    ): Promise<AttributeM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select({
          id: attributeInM2MEvent.id,
          eventType: attributeInM2MEvent.eventType,
          eventTimestamp: attributeInM2MEvent.eventTimestamp,
          attributeId: attributeInM2MEvent.attributeId,
        })
        .from(attributeInM2MEvent)
        .where(afterEventIdFilter(attributeInM2MEvent.id, lastEventId))
        .orderBy(asc(attributeInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map((event) => AttributeM2MEvent.parse(event));
    },
  };
}

export type M2MEventReaderServiceSQL = ReturnType<
  typeof m2mEventReaderServiceSQLBuilder
>;
