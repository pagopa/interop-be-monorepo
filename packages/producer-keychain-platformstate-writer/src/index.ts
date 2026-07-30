import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import {
  AuthorizationEvent,
  CorrelationId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import { config } from "./config/config.js";
import { handleMessageV2 } from "./consumerServiceV2.js";

const dynamoDBClient = new DynamoDBClient();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AuthorizationEvent);

  const loggerInstance = logger({
    serviceName: "producer-keychain-platformstate-writer",
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
      handleMessageV2(
        msg,
        dynamoDBClient,
        config.producerKeychainPlatformStatesTableName,
        loggerInstance
      )
    )
    .with({ event_version: 1 }, () => Promise.resolve())
    .exhaustive();

  loggerInstance.info(
    `Producer keychain platform state was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.authorizationTopic],
  processMessage,
  "producer-keychain-platformstate-writer"
);
