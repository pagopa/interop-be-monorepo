import { MessageType } from "@protobuf-ts/runtime";
import { Event } from "pagopa-interop-commons";
import {
  AgreementEvent,
  agreementEventToBinaryData,
  AgreementId,
  AttributeEvent,
  attributeEventToBinaryData,
  AttributeId,
  AuthorizationEvent,
  authorizationEventToBinaryData,
  catalogEventToBinaryData,
  ClientId,
  DelegationEvent,
  delegationEventToBinaryDataV2,
  DelegationId,
  EServiceEvent,
  EServiceId,
  ProducerKeychainId,
  protobufDecoder,
  PurposeEvent,
  purposeEventToBinaryData,
  PurposeId,
  TenantEvent,
  tenantEventToBinaryData,
  TenantId,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import { match } from "ts-pattern";

type EventStoreSchema =
  | "agreement"
  | "attribute"
  | "catalog"
  | "tenant"
  | "purpose"
  | '"authorization"'
  | "delegation";

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

export async function writeInEventstore<T extends EventStoreSchema>(
  event: T extends "agreement"
    ? StoredEvent<AgreementEvent>
    : T extends "attribute"
    ? StoredEvent<AttributeEvent>
    : T extends "catalog"
    ? StoredEvent<EServiceEvent>
    : T extends "tenant"
    ? StoredEvent<TenantEvent>
    : T extends "purpose"
    ? StoredEvent<PurposeEvent>
    : T extends '"authorization"'
    ? StoredEvent<AuthorizationEvent>
    : T extends "delegation"
    ? StoredEvent<DelegationEvent>
    : never,
  schema: T,
  postgresDB: IDatabase<unknown>
): Promise<void> {
  await postgresDB.none(
    `INSERT INTO ${schema}.events(stream_id, version, type, event_version, data) VALUES ($1, $2, $3, $4, $5)`,
    [
      event.stream_id,
      event.version,
      event.event.type,
      event.event.event_version,
      match<EventStoreSchema>(schema)
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
        .with("purpose", () =>
          purposeEventToBinaryData(event.event as PurposeEvent)
        )
        .with('"authorization"', () =>
          authorizationEventToBinaryData(event.event as AuthorizationEvent)
        )
        .with("delegation", () =>
          delegationEventToBinaryDataV2(event.event as DelegationEvent)
        )
        .exhaustive(),
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
    : T extends "purpose"
    ? PurposeId
    : T extends '"authorization"'
    ? ClientId | ProducerKeychainId
    : T extends "delegation"
    ? DelegationId
    : never,
  schema: T,
  postgresDB: IDatabase<unknown>
): Promise<
  ReadEvent<
    T extends "agreement"
      ? AgreementEvent
      : T extends "attribute"
      ? AttributeEvent
      : T extends "catalog"
      ? EServiceEvent
      : T extends "tenant"
      ? TenantEvent
      : T extends "purpose"
      ? PurposeEvent
      : T extends '"authorization"'
      ? AuthorizationEvent
      : T extends "delegation"
      ? DelegationEvent
      : never
  >
> {
  return postgresDB.one(
    `SELECT * FROM ${schema}.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1`,
    [streamId]
  );
}

export async function readEventByStreamIdAndVersion<T extends EventStoreSchema>(
  streamId: T extends "agreement"
    ? AgreementId
    : T extends "attribute"
    ? AttributeId
    : T extends "catalog"
    ? EServiceId
    : T extends "tenant"
    ? TenantId
    : T extends "purpose"
    ? PurposeId
    : T extends '"authorization"'
    ? ClientId | ProducerKeychainId
    : T extends "delegation"
    ? DelegationId
    : never,
  version: number,
  schema: T,
  postgresDB: IDatabase<unknown>
): Promise<
  ReadEvent<
    T extends "agreement"
      ? AgreementEvent
      : T extends "attribute"
      ? AttributeEvent
      : T extends "catalog"
      ? EServiceEvent
      : T extends "tenant"
      ? TenantEvent
      : T extends "purpose"
      ? PurposeEvent
      : T extends '"authorization"'
      ? AuthorizationEvent
      : T extends "delegation"
      ? DelegationEvent
      : never
  >
> {
  return postgresDB.one(
    `SELECT * FROM ${schema}.events WHERE stream_id = $1 and version = $2 ORDER BY sequence_num DESC LIMIT 1`,
    [streamId, version]
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
