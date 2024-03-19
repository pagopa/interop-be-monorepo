import { IDatabase } from "pg-promise";
import { z } from "zod";
import { MessageType } from "@protobuf-ts/runtime";
import {
  AgreementId,
  AttributeId,
  EServiceId,
  TenantId,
  protobufDecoder,
} from "pagopa-interop-models";

export type StoredEvent = {
  stream_id: string;
  version: string;
  type: Event["type"];
  event_version: number;
  data: Uint8Array;
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

export async function writeInEventstore(
  event: StoredEvent,
  schema: EventStoreSchema,
  postgresDB: IDatabase<unknown>
): Promise<void> {
  await postgresDB.none(
    `INSERT INTO ${schema}.events(stream_id, version, type, event_version, data) VALUES ($1, $2, $3, $4, $5)`,
    [
      event.stream_id,
      event.version,
      event.type,
      event.event_version,
      event.data,
    ]
  );
}

export async function readLastEventByStreamId<T extends EventStoreSchema>(
  streamId: T extends "agreement"
    ? AgreementId
    : T extends "attribute"
    ? AttributeId
    : T extends "catalog"
    ? EServiceId
    : T extends "tenant"
    ? TenantId
    : never,
  schema: T,
  postgresDB: IDatabase<unknown>
): Promise<StoredEvent> {
  return postgresDB.one(
    `SELECT * FROM ${schema}.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1`,
    [streamId]
  );
}

export function decodeProtobufPayload<I extends object>({
  messageType,
  payload,
}: {
  messageType: MessageType<I>;
  payload: Uint8Array;
}): I {
  return protobufDecoder(messageType).parse(payload);
}
