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
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { handleMessageV1 } from "./consumerServiceV1.js";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { tenantWriterServiceBuilder } from "./tenantWriterService.js";

const db = makeDrizzleConnection(config);
const tenantWriterService = tenantWriterServiceBuilder(db);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, TenantEvent);

  const loggerInstance = logger({
    serviceName: "tenant-readmodel-writer-sql",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) =>
      handleMessageV1(msg, tenantWriterService)
    )
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(msg, tenantWriterService)
    )
    .exhaustive();
  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.tenantTopic],
  processMessage,
  "tenant-readmodel-writer-sql"
);
