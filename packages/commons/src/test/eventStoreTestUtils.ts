import { IDatabase } from "pg-promise";
import { z } from "zod";
import { StoredEvent } from "../index.js";

export const eventStoreSchema = {
  agreement: "agreement",
  attribute: "attribute",
  catalog: "catalog",
  tenant: "tenant",
} as const;

export const EventStoreSchema = z.enum([
  Object.values(eventStoreSchema)[0],
  ...Object.values(eventStoreSchema).slice(1),
]);
export type EventStoreSchema = z.infer<typeof EventStoreSchema>;

export const readLastEventByStreamId = async <T extends StoredEvent>(
  streamId: string,
  schema: EventStoreSchema,
  postgresDB: IDatabase<unknown>
): Promise<T | undefined> =>
  await postgresDB.one(
    `SELECT * FROM ${schema}.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1`,
    [streamId]
  );
