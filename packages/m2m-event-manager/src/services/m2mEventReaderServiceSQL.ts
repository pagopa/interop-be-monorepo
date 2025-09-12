import { attributeM2MEventInM2MEvent } from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { AttributeM2MEvent } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function m2mEventReaderServiceSQLBuilder(
  m2mEventDB: ReturnType<typeof drizzle>
) {
  return {
    async getAttributeM2MEvents(): Promise<AttributeM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select({
          id: attributeM2MEventInM2MEvent.id,
          eventType: attributeM2MEventInM2MEvent.eventType,
          eventTimestamp: attributeM2MEventInM2MEvent.eventTimestamp,
          attributeId: attributeM2MEventInM2MEvent.attributeId,
        })
        .from(attributeM2MEventInM2MEvent);
      // TODO lastEventId and limit filtering
      // TODO sorting by eventTimestamp or by timestamp in uudiv7
      return sqlEvents.map((event) => AttributeM2MEvent.parse(event));
    },
  };
}

export type M2MEventReaderServiceSQL = ReturnType<
  typeof m2mEventReaderServiceSQLBuilder
>;
