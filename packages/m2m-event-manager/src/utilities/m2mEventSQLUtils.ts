import { SQL, and, eq, gt, or } from "drizzle-orm";
import {
  agreementM2MEventInM2MEvent,
  attributeM2MEventInM2MEvent,
  clientM2MEventInM2MEvent,
  eserviceM2MEventInM2MEvent,
  eserviceTemplateM2MEventInM2MEvent,
  producerKeychainM2MEventInM2MEvent,
  purposeM2MEventInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { m2mEventVisibility } from "pagopa-interop-models";

export function afterEventIdFilter<
  T extends
    | typeof attributeM2MEventInM2MEvent
    | typeof eserviceM2MEventInM2MEvent
>(table: T, lastEventId: string | undefined): SQL | undefined {
  return lastEventId ? gt(table.id, lastEventId) : undefined;
  // ^ event ID is a UUIDv7, lexicographical order is the same as chronological order
}

export function visibilityFilter<
  T extends
    | typeof eserviceM2MEventInM2MEvent
    | typeof eserviceTemplateM2MEventInM2MEvent
    | typeof agreementM2MEventInM2MEvent
    | typeof purposeM2MEventInM2MEvent
    | typeof clientM2MEventInM2MEvent
    | typeof producerKeychainM2MEventInM2MEvent
>(
  table: T,
  {
    ownerFilter,
    restrictedFilter,
  }: {
    ownerFilter: SQL | undefined;
    restrictedFilter: SQL | undefined;
  }
): SQL | undefined {
  return or(
    eq(table.visibility, m2mEventVisibility.public),
    ownerFilter
      ? and(eq(table.visibility, m2mEventVisibility.owner), ownerFilter)
      : undefined,
    restrictedFilter
      ? and(
          eq(table.visibility, m2mEventVisibility.restricted),
          restrictedFilter
        )
      : undefined
  );
}
