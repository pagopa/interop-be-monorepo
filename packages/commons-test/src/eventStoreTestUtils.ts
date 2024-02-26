import { IDatabase } from "pg-promise";
import { z } from "zod";
import { MessageType } from "@protobuf-ts/runtime";

export type StoredEvent = {
  stream_id: string;
  version: string;
  type: Event["type"];
  event_version: number;
  data: Buffer;
};

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

export function decodeProtobufPayload<I extends object>({
  messageType,
  payload,
}: {
  messageType: MessageType<I>;
  payload: Parameters<typeof Buffer.from>[0];
}): I {
  return messageType.fromBinary(Buffer.from(payload, "hex"));
}
