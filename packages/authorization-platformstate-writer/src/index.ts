import { EachMessagePayload } from "kafkajs";
import {
  logger,
  decodeKafkaMessage,
  TokenGenerationReadModelRepository,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { AuthorizationEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { handleMessageV1 } from "./consumerServiceV1.js";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { config } from "./config/config.js";
import { authorizationPlatfromStateReadModelServiceBuilder } from "./utils.js";

const dynamoDBClient = new DynamoDBClient({});
async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMessage = decodeKafkaMessage(message, AuthorizationEvent);

  const loggerInstance = logger({
    serviceName: "authorization-platformstate-writer",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });

  const tokenGenerationReadModelRepository =
    TokenGenerationReadModelRepository.init({
      dynamoDBClient,
      platformStatesTableName: config.tokenGenerationReadModelTableNamePlatform,
      tokenGenerationStatesTableName:
        config.tokenGenerationReadModelTableNameTokenGeneration,
    });

  const service = authorizationPlatfromStateReadModelServiceBuilder(
    tokenGenerationReadModelRepository
  );

  await match(decodedMessage)
    .with({ event_version: 1 }, (msg) => handleMessageV1(msg, service))
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg, service))
    .exhaustive();

  loggerInstance.info(
    `Token-generation read model was updated. Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.authorizationTopic], processMessage);
