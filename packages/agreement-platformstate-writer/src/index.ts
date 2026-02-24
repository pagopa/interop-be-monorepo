import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import {
  AgreementEvent,
  CorrelationId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { handleMessageV1 } from "./consumerServiceV1.js";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { config } from "./config/config.js";

const dynamoDBClient = new DynamoDBClient();
async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AgreementEvent);

  const loggerInstance = logger({
    serviceName: "agreement-platformstate-writer",
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
      handleMessageV1(msg, dynamoDBClient, loggerInstance)
    )
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2(msg, dynamoDBClient, loggerInstance)
    )
    .exhaustive();

  loggerInstance.info(
    `Token-generation read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.agreementTopic],
  processMessage,
  "agreement-platformstate-writer"
);
