import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { AttributeM2MEvent, dateToString } from "pagopa-interop-models";
import { attributeInM2MEvent } from "pagopa-interop-m2m-event-db-models";
import { m2mEventServiceBuilder } from "../src/services/m2mEventService.js";
import { m2mEventReaderServiceSQLBuilder } from "../src/services/m2mEventReaderServiceSQL.js";

export const { cleanup, m2mEventDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("m2mEventDbConfig")
);

afterEach(cleanup);

const m2mEventReaderServiceSQL = m2mEventReaderServiceSQLBuilder(m2mEventDB);
export const m2mEventService = m2mEventServiceBuilder(m2mEventReaderServiceSQL);

export async function writeAttributeM2MEvent(
  event: AttributeM2MEvent
): Promise<void> {
  await m2mEventDB.insert(attributeInM2MEvent).values([
    {
      ...event,
      eventTimestamp: dateToString(event.eventTimestamp),
    },
  ]);
}
