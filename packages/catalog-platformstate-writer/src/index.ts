import { EachMessagePayload } from "kafkajs";
import { logger, decodeKafkaMessage } from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { EServiceEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { handleMessageV1 } from "./consumerServiceV1.js";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { config } from "./config/config.js";

const dynamoDBClient = new DynamoDBClient({
  credentials: {
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
  },
  region: config.awsRegion,
  endpoint: `http://${config.tokenGenerationReadModelDbHost}:${config.tokenGenerationReadModelDbPort}`,
});

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, EServiceEvent);

  const loggerInstance = logger({
    serviceName: "catalog-platformstate-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) => handleMessageV1(msg, dynamoDBClient))
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, dynamoDBClient))
    .exhaustive();

  loggerInstance.info(
    `Token-generation read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.catalogTopic], processMessage);
