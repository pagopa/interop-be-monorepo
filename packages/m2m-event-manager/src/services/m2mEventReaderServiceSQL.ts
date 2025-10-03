import {
  attributeInM2MEvent,
  eserviceInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  AttributeM2MEvent,
  AttributeM2MEventId,
  EServiceM2MEvent,
  EServiceM2MEventId,
  TenantId,
} from "pagopa-interop-models";
import { and, asc, eq, or } from "drizzle-orm";
import {
  afterEventIdFilter,
  visibilityFilter,
} from "../utilities/m2mEventSQLUtils.js";
import { fromAttributeM2MEventSQL } from "../model/attributeM2MEventAdapterSQL.js";
import { fromEServiceM2MEventSQL } from "../model/eserviceM2MEventAdapterSQL.js";

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
        .select()
        .from(attributeInM2MEvent)
        .where(afterEventIdFilter(attributeInM2MEvent, lastEventId))
        .orderBy(asc(attributeInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromAttributeM2MEventSQL);
    },

    async getEServiceM2MEvents(
      lastEventId: EServiceM2MEventId | undefined,
      limit: number,
      requester: TenantId
    ): Promise<EServiceM2MEvent[]> {
      const sqlEvents = await m2mEventDB
        .select()
        .from(eserviceInM2MEvent)
        .where(
          and(
            afterEventIdFilter(eserviceInM2MEvent, lastEventId),
            visibilityFilter(eserviceInM2MEvent, {
              ownerFilter: or(
                eq(eserviceInM2MEvent.producerId, requester),
                eq(eserviceInM2MEvent.producerDelegateId, requester)
              ),
              restrictedFilter: undefined,
            })
          )
        )
        .orderBy(asc(eserviceInM2MEvent.id))
        .limit(limit);

      return sqlEvents.map(fromEServiceM2MEventSQL);
    },
  };
}

export type M2MEventReaderServiceSQL = ReturnType<
  typeof m2mEventReaderServiceSQLBuilder
>;
