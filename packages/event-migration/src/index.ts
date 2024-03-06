/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { ConnectionString } from "connection-string";
import { EServiceEventV1 } from "pagopa-interop-models";
import pgPromise, { IDatabase } from "pg-promise";
import {
  IClient,
  IConnectionParameters,
} from "pg-promise/typescript/pg-subset.js";
import { match } from "ts-pattern";

export type DB = IDatabase<unknown>;

export function initDB({
  username,
  password,
  host,
  port,
  database,
  schema,
  useSSL,
}: {
  username: string;
  password: string;
  host: string;
  port: number;
  database: string;
  schema: string;
  useSSL: boolean;
}): DB {
  const pgp = pgPromise({
    schema,
  });

  const conData = new ConnectionString(
    `postgresql://${username}:${password}@${host}:${port}/${database}`
  );

  const dbConfig: IConnectionParameters<IClient> = {
    database: conData.path !== undefined ? conData.path[0] : "",
    host: conData.hostname,
    password: conData.password,
    port: conData.port,
    user: conData.user,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  };

  return pgp(dbConfig);
}

console.log("Starting migration");

console.log("Initializing connections to source database");
const sourceConnection = initDB({
  username: "root",
  password: "root",
  host: "localhost",
  port: 6001,
  database: "old",
  schema: "public",
  useSSL: false,
});

console.log("Initializing connections to target database");
const targetConnection = initDB({
  username: "root",
  password: "root",
  host: "localhost",
  port: 6001,
  database: "root",
  schema: "catalog",
  useSSL: false,
});

console.log("reading events from source database");
const originalEvents = await sourceConnection.many(
  "SELECT event_ser_manifest, event_payload, write_timestamp FROM event_journal order by ordering ASC"
);

const idVersionHashMap = new Map<string, number>();

for (const event of originalEvents) {
  console.log(event);
  const { event_ser_manifest, event_payload, write_timestamp } = event;

  const eventType = match(
    event_ser_manifest
      .replace("it.pagopa.interop.catalogmanagement.model.persistence.", "")
      .split("|")[0]
  )
    .with("CatalogItemDescriptorItemAdded", () => "EServiceDescriptorAdded")
    .when(
      (originalType) => (originalType as string).includes("CatalogItem"),
      (originalType) =>
        (originalType as string).replace("CatalogItem", "EService")
    )
    .otherwise((originalType) => `UnknownType: ${originalType}`);

  const eventToDecode = EServiceEventV1.safeParse({
    type: eventType,
    event_version: 1,
    data: event_payload,
  });

  if (!eventToDecode.success) {
    console.error(
      `Error decoding event ${eventType} with payload ${event_payload}`
    );
    continue;
  }

  console.log(eventToDecode.data);

  const anyPayload = eventToDecode.data.data as any;
  const id = anyPayload.eService
    ? anyPayload.eService.id
    : anyPayload.eServiceId;

  let version = idVersionHashMap.get(id);
  if (version === undefined) {
    version = 0;
  } else {
    version++;
  }
  idVersionHashMap.set(id, version);

  const newEvent: {
    stream_id: string;
    version: number;
    type: string;
    eventVersion: number;
    data: string;
    logDate: Date;
  } = {
    stream_id: id,
    version,
    type: eventType,
    eventVersion: 1,
    data: event_payload,
    logDate: new Date(parseInt(write_timestamp, 10)),
  };
  console.log(newEvent);

  await targetConnection.none(
    "INSERT INTO events(stream_id, version, type, event_version, data, log_date) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      newEvent.stream_id,
      newEvent.version,
      newEvent.type,
      newEvent.eventVersion,
      newEvent.data,
      newEvent.logDate,
    ]
  );
}
