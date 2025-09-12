import { attributeM2MEventInM2MEvent } from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { AttributeM2MEvent, AttributeM2MEventId } from "pagopa-interop-models";
import { desc, gt } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventReaderServiceSQLBuilder(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  return {
    async getAttributeM2MEvents(
      lastEventId: AttributeM2MEventId | undefined,
      limit: number
    ): Promise<AttributeM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select({
          id: attributeM2MEventInM2MEvent.id,
          eventType: attributeM2MEventInM2MEvent.eventType,
          eventTimestamp: attributeM2MEventInM2MEvent.eventTimestamp,
          attributeId: attributeM2MEventInM2MEvent.attributeId,
        })
        .from(attributeM2MEventInM2MEvent)
        .where(
          lastEventId
            ? gt(attributeM2MEventInM2MEvent.id, lastEventId)
            : undefined
          // ^ event ID is a UUIDv7, lexicographical order is the same as chronological order
        )
        .orderBy(desc(attributeM2MEventInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map((event) => AttributeM2MEvent.parse(event));
    },
  };
}

export type M2MEventReaderServiceSQL = ReturnType<
  typeof m2mEventReaderServiceSQLBuilder
>;
