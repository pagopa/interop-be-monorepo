import { desc } from "drizzle-orm";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { attributeM2MEventInM2MEvent } from "pagopa-interop-m2m-event-db-models";
import { afterEach, inject } from "vitest";
import { AttributeM2MEvent } from "pagopa-interop-models";
import { m2mEventWriterServiceSQLBuilder } from "../src/services/m2mEventWriterServiceSQL.js";

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

export async function retrieveLastAttributeM2MEvent(): Promise<AttributeM2MEvent> {
  const sqlEvents = await m2mEventDB
    .select()
    .from(attributeM2MEventInM2MEvent)
    .orderBy(desc(attributeM2MEventInM2MEvent.id))
    .limit(1);

  return AttributeM2MEvent.parse(sqlEvents[0]);
}
