import { desc } from "drizzle-orm";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { attributeM2MEventInM2MEvent } from "pagopa-interop-m2m-event-db-models";
import { afterEach, inject } from "vitest";
import { AttributeM2MEvent } from "pagopa-interop-models";
import { delegationReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { m2mEventWriterServiceSQLBuilder } from "../src/services/m2mEventWriterServiceSQL.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, readModelDB, m2mEventDB } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig"),
    undefined,
    undefined,
    inject("m2mEventDbConfig")
  );

afterEach(cleanup);

export const testM2mEventWriterService =
  m2mEventWriterServiceSQLBuilder(m2mEventDB);

export const testReadModelService = readModelServiceBuilderSQL({
  delegationReadModelServiceSQL: delegationReadModelServiceBuilder(readModelDB),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getMockEventEnvelopeCommons = () => ({
  sequence_num: 1,
  version: 1,
  event_version: 2,
  log_date: new Date(),
});

export async function retrieveLastAttributeM2MEvent(): Promise<AttributeM2MEvent> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(attributeM2MEventInM2MEvent)
    .orderBy(desc(attributeM2MEventInM2MEvent.id))
    .limit(1);

  return AttributeM2MEvent.parse(sqlEvents[0]);
}
