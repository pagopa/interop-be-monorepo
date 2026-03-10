import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { config } from "../src/config/config.js";

export const { cleanup, postgresDB } = await setupTestContainersVitest(
  inject("eventStoreConfig")
);

export async function getLastEventByKid(
  kid: string
): Promise<{ event_id: number; kid: string; event_type: "ADDED" | "DELETED" }> {
  return postgresDB.one(
    `SELECT * FROM ${config.eventStoreDbSchema}.producer_keys_events WHERE kid = $1 ORDER BY event_id DESC LIMIT 1`,
    [kid]
  );
}

afterEach(cleanup);
