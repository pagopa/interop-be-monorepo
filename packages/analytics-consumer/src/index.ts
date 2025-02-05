import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  genericLogger,
  logger,
} from "pagopa-interop-commons";
import {
  genericInternalError,
  unsafeBrandId,
  generateId,
  CorrelationId,
  kafkaMessageProcessError,
} from "pagopa-interop-models";
import { runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import { topicConfigMap } from "./utils.js";
import { config } from "./config/config.js";

export async function processMessage(
  messagePayload: EachMessagePayload
): Promise<void> {
  const { topic, partition, message } = messagePayload;
  const topicItem = topicConfigMap[topic];

  if (!topicItem) {
    throw genericInternalError(`Unknown topic: ${topic}`);
  }
  const decoded = decodeKafkaMessage(message, topicItem.decoder);
  const handler = match(decoded.event_version)
    .with(1, 2, (event_version) => topicItem.handlers[event_version])
    .exhaustive();

  const correlationId: CorrelationId = decoded.correlation_id
    ? unsafeBrandId(decoded.correlation_id)
    : generateId();

  const loggerInstance = logger({
    serviceName: "analytics-consumer",
    eventType: decoded.type,
    eventVersion: decoded.event_version,
    streamId: decoded.stream_id,
    correlationId,
  });

  loggerInstance.info(
    `Processing ${decoded.type} message - Partition ${partition} - Offset ${message.offset}`
  );

  await handler(decoded);
}

try {
  await runConsumer(
    config,
    [
      config.attributeTopic,
      config.agreementTopic,
      config.catalogTopic,
      config.purposeTopic,
      config.tenantTopic,
      config.delegationTopic,
      config.authorizationTopic,
    ],
    async (payload) => {
      try {
        await processMessage(payload);
      } catch (err) {
        throw kafkaMessageProcessError(
          payload.topic,
          payload.partition,
          payload.message.offset,
          err
        );
      }
    }
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
