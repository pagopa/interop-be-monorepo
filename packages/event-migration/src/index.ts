import { ConnectionString } from "connection-string";
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

const sourceConnection = initDB({
  username: "postgres",
  password: "postgres",
  host: "localhost",
  port: 5432,
  database: "postgres",
  schema: "public",
  useSSL: false,
});

const targetConnection = initDB({
  username: "postgres",
  password: "postgres",
  host: "localhost",
  port: 5432,
  database: "postgres",
  schema: "public",
  useSSL: false,
});

const originalEvents = await sourceConnection.many(
  "SELECT persistence_id, sequence_number, event_ser_manifest, event_payload, write_timestamp FROM event_journal"
);

for (const event of originalEvents) {
  const {
    persistence_id,
    sequence_number,
    event_ser_manifest,
    event_payload,
    write_timestamp,
  } = event;

  const newEvent: {
    stream_id: string;
    version: number;
    type: string;
    eventVersion: number;
    data: string;
    logData: Date;
  } = {
    stream_id: persistence_id,
    version: sequence_number,
    type: match(event_ser_manifest)
      .with("CatalogItemDescriptorItemAdded", () => "EServiceDescriptorAdded")
      .when(
        (originalType) => originalType.contains("CatalogItem"),
        (originalType) => originalType.replace("CatalogItem", "EService")
      )
      .otherwise((originalType) => `UnknownType: ${originalType}`),
    eventVersion: 1,
    data: event_payload,
    logData: new Date(write_timestamp),
  };

  await targetConnection.none(
    "INSERT INTO events(stream_id, version, type, event_version, data, log_data) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      newEvent.stream_id,
      newEvent.version,
      newEvent.type,
      newEvent.eventVersion,
      newEvent.data,
      newEvent.logData,
    ]
  );
}
