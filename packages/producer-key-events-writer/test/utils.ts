import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { config } from "../src/config/config.js";

export const { cleanup, postgresDB } = setupTestContainersVitest(
  undefined,
  inject("eventStoreConfig")
);

export async function getLastEventByKid(kid: string): Promise<unknown> {
  return postgresDB.one(
    `SELECT * FROM ${config.eventStoreDbName}.producer_keys_events WHERE kid = $1 ORDER BY sequence_num DESC LIMIT 1`,
    [kid]
  );
}

afterEach(cleanup);
