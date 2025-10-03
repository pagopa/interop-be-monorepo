import { SQL, and, eq, gt, or } from "drizzle-orm";
import {
  agreementInM2MEvent,
  attributeInM2MEvent,
  clientInM2MEvent,
  eserviceInM2MEvent,
  eserviceTemplateInM2MEvent,
  producerKeychainInM2MEvent,
  purposeInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { m2mEventVisibility } from "pagopa-interop-models";

export function afterEventIdFilter<
  T extends typeof attributeInM2MEvent | typeof eserviceInM2MEvent
>(table: T, lastEventId: string | undefined): SQL | undefined {
  return lastEventId ? gt(table.id, lastEventId) : undefined;
  // ^ event ID is a UUIDv7, lexicographical order is the same as chronological order
}

export function visibilityFilter<
  T extends
    | typeof eserviceInM2MEvent
    | typeof eserviceTemplateInM2MEvent
    | typeof agreementInM2MEvent
    | typeof purposeInM2MEvent
    | typeof clientInM2MEvent
    | typeof producerKeychainInM2MEvent
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
  const {
    public: publicVisibility,
    owner: ownerVisibility,
    restricted: restrictedVisibility,
    ...rest
  } = m2mEventVisibility;
  void (rest satisfies Record<string, never>);
  // ^ ensure all visibilities are handled

  return or(
    eq(table.visibility, publicVisibility),
    ownerFilter
      ? and(eq(table.visibility, ownerVisibility), ownerFilter)
      : undefined,
    restrictedFilter
      ? and(eq(table.visibility, restrictedVisibility), restrictedFilter)
      : undefined
  );
}
