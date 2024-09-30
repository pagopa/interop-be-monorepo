/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { ConnectionString } from "connection-string";
import { keyToClientJWKKey, decodeBase64ToPem } from "pagopa-interop-commons";
import {
  AgreementEventV1,
  AttributeEvent,
  AuthorizationEvent,
  authorizationEventToBinaryData,
  EServiceEventV1,
  fromKeyV1,
  Key,
  KeyEntryV1,
  PurposeEventV1,
  Tenant,
  TenantEventV1,
  toKeyV1,
  unsafeBrandId,
} from "pagopa-interop-models";
import pgPromise, { IDatabase } from "pg-promise";
import {
  IClient,
  IConnectionParameters,
} from "pg-promise/typescript/pg-subset.js";
import { match } from "ts-pattern";
import { z } from "zod";
import { connectToReadModel } from "./utils.js";

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
    TENANT_READMODEL_COLLECTION_NAME: z.string(),
    TENANT_READMODEL_DB_HOST: z.string(),
    TENANT_READMODEL_DB_NAME: z.string(),
    TENANT_READMODEL_DB_USERNAME: z.string(),
    TENANT_READMODEL_DB_PASSWORD: z.string(),
    TENANT_READMODEL_DB_PORT: z.coerce.number().min(1001),
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
    tenantCollection: {
      collectionName: c.TENANT_READMODEL_COLLECTION_NAME,
      readModelDbHost: c.TENANT_READMODEL_DB_HOST,
      readModelDbName: c.TENANT_READMODEL_DB_NAME,
      readModelDbUsername: c.TENANT_READMODEL_DB_USERNAME,
      readModelDbPassword: c.TENANT_READMODEL_DB_PASSWORD,
      readModelDbPort: c.TENANT_READMODEL_DB_PORT,
    },
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

function sanitizePEM(pem: string) {
  const group = pem.match(
    /(-----BEGIN (PUBLIC KEY|RSA PUBLIC KEY)-----)([\s\S]*?)(-----END (PUBLIC KEY|RSA PUBLIC KEY)-*)/
  );
  if (!group) {
    throw new Error("Invalid group match");
  }
  const begin = group[1];
  const keyType = group[2];
  const body = group[3];
  const cleanedBody = body.replace(/\s+/g, "");
  const formattedBody = cleanedBody.replace(/(.{64})/g, "$1\n");
  const fixedEnd = `-----END ${keyType}-----`;

  return `${begin}\n${formattedBody}\n${fixedEnd}`;
}

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
    (targetSchema) =>
      targetSchema.includes("authorization") || targetSchema.includes("authz"),
    () => {
      checkSchema(config.sourceDbSchema, "auth");

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
  .when(
    (targetSchema) => targetSchema.includes("tenant"),
    () => {
      checkSchema(config.sourceDbSchema, "tenant");
      const parseEventType = (event_ser_manifest: any) =>
        event_ser_manifest
          .replace("it.pagopa.interop.tenantmanagement.model.persistence.", "")
          .split("|")[0];

      const decodeEvent = (eventType: string, event_payload: any) =>
        TenantEventV1.safeParse({
          type: eventType,
          event_version: 1,
          data: event_payload,
        });

      const parseId = (anyPayload: any) =>
        anyPayload.tenant ? anyPayload.tenant.id : anyPayload.tenantId;

      return { parseEventType, decodeEvent, parseId };
    }
  )
  .otherwise(() => {
    throw new Error("Unhandled schema, please double-check the config");
  });

let skippedEvents = 0;

const readModel = connectToReadModel({
  readModelDbHost: config.tenantCollection.readModelDbHost,
  readModelDbPort: config.tenantCollection.readModelDbPort,
  readModelDbUsername: config.tenantCollection.readModelDbUsername,
  readModelDbPassword: config.tenantCollection.readModelDbPassword,
  readModelDbName: config.tenantCollection.readModelDbName,
});

const tenantsIdsToInclude = new Set(
  await readModel
    .db(config.tenantCollection.readModelDbName)
    .collection(config.tenantCollection.collectionName)
    .find({
      "data.selfcareId": { $exists: true, $ne: undefined },
    })
    .map(({ data }) => Tenant.parse(data).id)
    .toArray()
);

await readModel.close();

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
    config.targetDbSchema.includes("auth") &&
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

  // For tenant, we only migrate events related to tenants that have been linked to a selfcareId

  if (
    config.targetDbSchema.includes("tenant") &&
    !tenantsIdsToInclude.has(id)
  ) {
    skippedEvents++;
    continue;
  }
  const parsedPayload =
    decodedEvent.data.type === "KeysAdded"
      ? Buffer.from(
          authorizationEventToBinaryData({
            type: "KeysAdded",
            event_version: 1,
            data: {
              clientId: id,
              keys: decodedEvent.data.data.keys.map((keyEntryV1) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const key = fromKeyV1(keyEntryV1.value!);
                try {
                  keyToClientJWKKey(key, unsafeBrandId(id));
                  return keyEntryV1;
                } catch (error) {
                  const decodedPem = decodeBase64ToPem(key.encodedPem);
                  const sanitizedPem = sanitizePEM(decodedPem);

                  const adjustedKey: Key = {
                    ...key,
                    encodedPem: Buffer.from(sanitizedPem).toString("base64"),
                  };

                  return {
                    keyId: keyEntryV1.keyId,
                    value: toKeyV1(adjustedKey),
                  } satisfies KeyEntryV1;
                }
              }),
            },
          })
        )
      : event_payload;

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
    data: parsedPayload,
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
