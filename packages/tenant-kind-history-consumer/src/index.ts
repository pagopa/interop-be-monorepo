import { match } from "ts-pattern";
import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  generateId,
  TenantEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "./config/config.js";
import { tenantKindhistoryConsumerServiceBuilder } from "./tenantKindHistoryConsumerService.js";
import { tenantKindHistoryWriterServiceBuilder } from "./tenantKindHistoryWriterService.js";

const tenantKindHistoryDB = drizzle({
  client: new pg.Pool({
    host: config.tenantKindHistoryDBHost,
    port: config.tenantKindHistoryDBPort,
    database: config.tenantKindHistoryDBName,
    user: config.tenantKindHistoryDBUsername,
    password: config.tenantKindHistoryDBPassword,
    ssl: config.tenantKindHistoryDBUseSSL
      ? { rejectUnauthorized: false }
      : undefined,
  }),
});

const tenantKindHistoryWriterService =
  tenantKindHistoryWriterServiceBuilder(tenantKindHistoryDB);
const tenantKindHistoryConsumerService =
  tenantKindhistoryConsumerServiceBuilder(tenantKindHistoryWriterService);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, TenantEvent);
  const correlationId = decodedMessage.correlation_id
    ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
    : generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: "tenant-kind-history-consumer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId,
  });

  loggerInstance.info(
    `Processing ${decodedMessage.type} message - Partition number: ${partition}. Offset: ${message.offset}`
  );

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) =>
      tenantKindHistoryConsumerService.handleMessageV1(msg, loggerInstance)
    )
    .with({ event_version: 2 }, (msg) =>
      tenantKindHistoryConsumerService.handleMessageV2(msg, loggerInstance)
    )
    .exhaustive();
}

await runConsumer(
  config,
  [config.tenantTopic],
  processMessage,
  "tenant-kind-history-consumer"
);
