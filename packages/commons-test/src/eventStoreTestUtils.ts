import { IDatabase } from "pg-promise";
import { MessageType } from "@protobuf-ts/runtime";
import {
  AgreementEvent,
  AgreementId,
  AttributeEvent,
  AttributeId,
  EServiceEvent,
  EServiceId,
  TenantEvent,
  TenantId,
  agreementEventToBinaryData,
  attributeEventToBinaryData,
  catalogEventToBinaryData,
  protobufDecoder,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { Event } from "pagopa-interop-commons";
import { match } from "ts-pattern";

export type StoredEvent<T extends Event> = {
  stream_id: string;
  version: number;
  event: T;
};

export type ReadEvent<T extends Event> = {
  stream_id: string;
  version: string;
  type: T["type"];
  event_version: number;
  data: Uint8Array;
};

export async function writeInEventstore(
  event:
    | StoredEvent<AgreementEvent>
    | StoredEvent<AttributeEvent>
    | StoredEvent<EServiceEvent>
    | StoredEvent<TenantEvent>,
  schema: string,
  postgresDB: IDatabase<unknown>
): Promise<void> {
  await postgresDB.none(
    `INSERT INTO ${schema}.events(stream_id, version, type, event_version, data) VALUES ($1, $2, $3, $4, $5)`,
    [
      event.stream_id,
      event.version,
      event.event.type,
      event.event.event_version,
      match(schema)
        .with("agreement", () =>
          agreementEventToBinaryData(event.event as AgreementEvent)
        )
        .with("attribute", () =>
          attributeEventToBinaryData(event.event as AttributeEvent)
        )
        .with("catalog", () =>
          catalogEventToBinaryData(event.event as EServiceEvent)
        )
        .with("tenant", () =>
          tenantEventToBinaryData(event.event as TenantEvent)
        )
        .with("purpose", () => {
          throw new Error("Purpose events not implemented yet");
        })
        .otherwise((v) => {
          throw new Error(`${v} events not implemented`);
        }),
    ]
  );
}

export async function readLastEventByStreamId<
  T extends AgreementId | AttributeId | EServiceId | TenantId
>(
  streamId: T,
  schema: string,
  postgresDB: IDatabase<unknown>
): Promise<ReadEvent<Event>> {
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
