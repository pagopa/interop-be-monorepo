import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  CorrelationId,
  generateId,
  PurposeEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { handleMessageV1 } from "./purposeConsumerServiceV1.js";
import { handleMessageV2 } from "./purposeConsumerServiceV2.js";
import { config } from "./config/config.js";
import { purposeWriterServiceBuilder } from "./purposeWriterService.js";

const db = makeDrizzleConnection(config);
const purposeWriterService = purposeWriterServiceBuilder(db);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, PurposeEvent);

  const loggerInstance = logger({
    serviceName: "purpose-readmodel-writer-sql",
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
      handleMessageV1(msg, purposeWriterService)
    )
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(msg, purposeWriterService)
    )
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.purposeTopic],
  processMessage,
  "purpose-readmodel-writer-sql"
);
