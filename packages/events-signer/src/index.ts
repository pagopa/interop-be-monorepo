/* eslint-disable functional/immutable-data */
import { runBatchConsumer } from "kafka-iam-auth";
import { EachBatchPayload, KafkaMessage } from "kafkajs";
import {
  genericLogger,
  initFileManager,
  createSafeStorageApiClient,
  dbServiceBuilder,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  baseConsumerConfig,
  batchConsumerConfig,
  config,
} from "./config/config.js";

import { executeTopicHandler } from "./handlers/batchMessageHandler.js";

const fileManager = initFileManager(config);
const dynamoDBClient = new DynamoDBClient();
const dbService = dbServiceBuilder(dynamoDBClient, config);
const safeStorageService = createSafeStorageApiClient(config);

async function processBatch({ batch }: EachBatchPayload): Promise<void> {
  const messages: KafkaMessage[] = batch.messages;
  await executeTopicHandler(
    messages,
    batch.topic,
    fileManager,
    dbService,
    safeStorageService
  );

  genericLogger.info(
    `Handled batch. Partition: ${
      batch.partition
    }. Offsets: ${batch.firstOffset()} -> ${batch.lastOffset()}`
  );
}
try {
  await runBatchConsumer(
    baseConsumerConfig,
    batchConsumerConfig,
    [
      config.authorizationTopic,
      config.agreementTopic,
      config.purposeTopic,
      config.delegationTopic,
      config.catalogTopic,
    ],
    processBatch,
    "events-signer"
  );
} catch (e) {
  genericLogger.error(`An error occurred during initialization:\n${e}`);
}
