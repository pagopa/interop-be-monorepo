/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { ConnectionString } from "connection-string";
import {
  AgreementEventV1,
  AttributeEvent,
  AuthorizationEvent,
  EServiceEventV1,
  PurposeEventV1,
} from "pagopa-interop-models";
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
    sourceDbPassword: encodeURIComponent(c.SOURCE_DB_PASSWORD),
    sourceDbHost: c.SOURCE_DB_HOST,
    sourceDbPort: c.SOURCE_DB_PORT,
    sourceDbName: c.SOURCE_DB_NAME,
    sourceDbSchema: c.SOURCE_DB_SCHEMA,
    sourceDbUseSSL: c.SOURCE_DB_USE_SSL,
    targetDbUsername: c.TARGET_DB_USERNAME,
    targetDbPassword: encodeURIComponent(c.TARGET_DB_PASSWORD),
    targetDbHost: c.TARGET_DB_HOST,
    targetDbPort: c.TARGET_DB_PORT,
    targetDbName: c.TARGET_DB_NAME,
    targetDbSchema: c.TARGET_DB_SCHEMA,
    targetDbUseSSL: c.TARGET_DB_USE_SSL,
  }));
export type Config = z.infer<typeof Config>;

export const config: Config = Config.parse(process.env);

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

const { parseEventType, decodeEvent, parseId } = match(config.targetDbSchema)
  .when(
    (targetSchema) => targetSchema.includes("catalog"),
    () => {
      checkSchema(config.sourceDbSchema, "catalog");
      const parseEventType = (event_ser_manifest: any) =>
        match(
          event_ser_manifest
            .replace(
              "it.pagopa.interop.catalogmanagement.model.persistence.",
              ""
            )
            .split("|")[0]
        )
          .when(
            (originalType) => (originalType as string).includes("CatalogItem"),
            (originalType) =>
              (originalType as string).replace("CatalogItem", "EService")
          )
          .otherwise((originalType) => originalType);

      const decodeEvent = (eventType: string, event_payload: any) =>
        EServiceEventV1.safeParse({
          type: eventType,
          event_version: 1,
          data: event_payload,
        });

      const parseId = (anyPayload: any) =>
        anyPayload.eservice ? anyPayload.eservice.id : anyPayload.eserviceId;

      return { parseEventType, decodeEvent, parseId };
    }
  )
  .when(
    (targetSchema) => targetSchema.includes("attribute"),
    () => {
      checkSchema(config.sourceDbSchema, "attribute");

      const parseEventType = (event_ser_manifest: any) =>
        match(
          event_ser_manifest
            .replace(
              "it.pagopa.interop.attributeregistrymanagement.model.persistence.",
              ""
            )
            .split("|")[0]
        )
          .with("AttributeDeleted", () => "MaintenanceAttributeDeleted")
          .otherwise((originalType) => originalType);

      const decodeEvent = (eventType: string, event_payload: any) =>
        AttributeEvent.safeParse({
          type: eventType,
          event_version: 1,
          data: event_payload,
        });

      const parseId = (anyPayload: any) =>
        anyPayload.attribute ? anyPayload.attribute.id : anyPayload.id;

      return { parseEventType, decodeEvent, parseId };
    }
  )
  .when(
    (targetSchema) => targetSchema.includes("purpose"),
    () => {
      checkSchema(config.sourceDbSchema, "purpose");
      const parseEventType = (event_ser_manifest: any) =>
        event_ser_manifest
          .replace("it.pagopa.interop.purposemanagement.model.persistence.", "")
          .split("|")[0];

      const decodeEvent = (eventType: string, event_payload: any) =>
        PurposeEventV1.safeParse({
          type: eventType,
          event_version: 1,
          data: event_payload,
        });

      const parseId = (anyPayload: any) =>
        anyPayload.purpose ? anyPayload.purpose.id : anyPayload.purposeId;

      return { parseEventType, decodeEvent, parseId };
    }
  )
  .when(
    (targetSchema) => targetSchema.includes("agreement"),
    () => {
      checkSchema(config.sourceDbSchema, "agreement");
      const parseEventType = (event_ser_manifest: any) =>
        event_ser_manifest
          .replace(
            "it.pagopa.interop.agreementmanagement.model.persistence.",
            ""
          )
          .split("|")[0];

      const decodeEvent = (eventType: string, event_payload: any) =>
        AgreementEventV1.safeParse({
          type: eventType,
          event_version: 1,
          data: event_payload,
        });

      const parseId = (anyPayload: any) =>
        anyPayload.agreement ? anyPayload.agreement.id : anyPayload.agreementId;

      return { parseEventType, decodeEvent, parseId };
    }
  )
  .when(
    (targetSchema) => targetSchema.includes("authorization"),
    () => {
      checkSchema(config.sourceDbSchema, "authorization");

      const parseEventType = (event_ser_manifest: any) =>
        event_ser_manifest
          .replace(
            "it.pagopa.interop.authorizationmanagement.model.persistence.",
            ""
          )
          .split("|")[0];

      const decodeEvent = (eventType: string, event_payload: any) =>
        AuthorizationEvent.safeParse({
          type: eventType,
          event_version: 1,
          data: event_payload,
        });

      const parseId = (anyPayload: any) =>
        anyPayload.client ? anyPayload.client.id : anyPayload.clientId;
      return { parseEventType, decodeEvent, parseId };
    }
  )
  .otherwise(() => {
    throw new Error("Unhandled schema, please double-check the config");
  });

let skippedEvents = 0;

for (const event of originalEvents) {
  console.log(event);
  const { event_ser_manifest, event_payload, write_timestamp } = event;

  const parsedEventType = parseEventType(event_ser_manifest);

  // Agreement has some event-store entries with no details about the event
  // the data updates related to these missing entries are going to be fixed by a custom script
  if (parsedEventType === "") {
    skippedEvents++;
    continue;
  }

  const authorizationEventsToSkip = [
    "EServiceStateUpdated",
    "AgreementStateUpdated",
    "PurposeStateUpdated",
    "AgreementAndEServiceStatesUpdated",
  ];
  // Authorization has some event-store entries that don't have to be migrated
  if (
    config.targetDbSchema.includes("authorization") &&
    authorizationEventsToSkip.includes(parsedEventType)
  ) {
    skippedEvents++;
    continue;
  }

  const decodedEvent = decodeEvent(parsedEventType, event_payload);
  if (!decodedEvent.success) {
    console.error(
      `Error decoding event ${parsedEventType} with payload ${event_payload}`
    );
    throw new Error("Error decoding event");
  }

  console.log(decodedEvent.data);

  const anyPayload = decodedEvent.data.data;
  const id = parseId(anyPayload);

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
    type: parsedEventType,
    eventVersion: 1,
    data: event_payload,
    logDate: new Date(parseInt(write_timestamp, 10)),
  };
  console.log(newEvent);

  await targetConnection.none(
    "INSERT INTO events(stream_id, version, correlation_id, type, event_version, data, log_date) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      newEvent.stream_id,
      newEvent.version,
      null,
      newEvent.type,
      newEvent.eventVersion,
      newEvent.data,
      newEvent.logDate,
    ]
  );
}

console.log(`Count of skipped events: ${skippedEvents}`);

function checkSchema(sourceSchema: string, schemaKind: string) {
  if (!sourceSchema.includes(schemaKind)) {
    throw new Error(
      "Source and target databases are incompatible, please double-check the config"
    );
  }
}
