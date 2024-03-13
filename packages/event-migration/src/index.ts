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
import { z } from "zod";

const Config = z
  .object({
    SOURCE_DB_USERNAME: z.string(),
    SOURCE_DB_PASSWORD: z.string(),
    SOURCE_DB_HOST: z.string(),
    SOURCE_DB_PORT: z.coerce.number(),
    SOURCE_DB_NAME: z.string(),
    SOURCE_DB_SCHEMA: z.string(),
    SOURCE_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    TARGET_DB_USERNAME: z.string(),
    TARGET_DB_PASSWORD: z.string(),
    TARGET_DB_HOST: z.string(),
    TARGET_DB_PORT: z.coerce.number(),
    TARGET_DB_NAME: z.string(),
    TARGET_DB_SCHEMA: z.string(),
    TARGET_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    sourceDbUsername: c.SOURCE_DB_USERNAME,
    sourceDbPassword: c.SOURCE_DB_PASSWORD,
    sourceDbHost: c.SOURCE_DB_HOST,
    sourceDbPort: c.SOURCE_DB_PORT,
    sourceDbName: c.SOURCE_DB_NAME,
    sourceDbSchema: c.SOURCE_DB_SCHEMA,
    sourceDbUseSSL: c.SOURCE_DB_USE_SSL,
    targetDbUsername: c.TARGET_DB_USERNAME,
    targetDbPassword: c.TARGET_DB_PASSWORD,
    targetDbHost: c.TARGET_DB_HOST,
    targetDbPort: c.TARGET_DB_PORT,
    targetDbName: c.TARGET_DB_NAME,
    targetDbSchema: c.TARGET_DB_SCHEMA,
    targetDbUseSSL: c.TARGET_DB_USE_SSL,
  }));
export type Config = z.infer<typeof Config>;

export const config: Config = {
  ...Config.parse(process.env),
};

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
  username: config.sourceDbUsername,
  password: config.sourceDbPassword,
  host: config.sourceDbHost,
  port: config.sourceDbPort,
  database: config.sourceDbName,
  schema: config.sourceDbSchema,
  useSSL: config.sourceDbUseSSL,
});

console.log("Initializing connections to target database");
const targetConnection = initDB({
  username: config.targetDbUsername,
  password: config.targetDbPassword,
  host: config.targetDbHost,
  port: config.targetDbPort,
  database: config.targetDbName,
  schema: config.targetDbSchema,
  useSSL: config.targetDbUseSSL,
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
    throw new Error("Error decoding event");
  }

  console.log(eventToDecode.data);

  const anyPayload = eventToDecode.data.data as any;
  const id = anyPayload.eservice
    ? anyPayload.eservice.id
    : anyPayload.eserviceId;

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
