/* eslint-disable functional/immutable-data */
import { runBatchConsumer } from "kafka-iam-auth";
import { EachBatchPayload, KafkaMessage } from "kafkajs";
import { genericLogger, initFileManager } from "pagopa-interop-commons";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  baseConsumerConfig,
  batchConsumerConfig,
  config,
  safeStorageApiConfig,
} from "./config/config.js";

import { dbServiceBuilder } from "./services/dbService.js";
import { executeTopicHandler } from "./handlers/batchMessageHandler.js";
import { createSafeStorageApiClient } from "./services/safeStorageService.js";

const fileManager = initFileManager(config);
const dynamoDBClient = new DynamoDBClient();
const dbService = dbServiceBuilder(dynamoDBClient);
const safeStorageService = createSafeStorageApiClient(safeStorageApiConfig);

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
