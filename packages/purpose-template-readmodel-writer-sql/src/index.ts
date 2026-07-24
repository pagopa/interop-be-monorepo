import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import {
  CorrelationId,
  generateId,
  PurposeTemplateEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { match } from "ts-pattern";

import { config } from "./config/config.js";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { purposeTemplateWriterServiceBuilder } from "./purposeTemplateWriterService.js";

const purposeTemplateWriterService = purposeTemplateWriterServiceBuilder(
  makeDrizzleConnection(config)
);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, PurposeTemplateEvent);

  const loggerInstance = logger({
    serviceName: "purpose-template-readmodel-writer-sql",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });
  await match(decodedMessage)
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(msg, purposeTemplateWriterService)
    )
    .exhaustive();

  loggerInstance.info(
    `Read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.purposeTemplateTopic],
  processMessage,
  config.featureFlagConfluentKafka,
  "purpose-template-readmodel-writer-sql"
);
