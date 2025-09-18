import {
  FileManager,
  initFileManager,
  initQueueManager,
  logger,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Message } from "@aws-sdk/client-sqs";
import { config, safeStorageApiConfig } from "./config/config.js";
import {
  DbServiceBuilder,
  dbServiceBuilder,
} from "./services/dynamoService.js";
import {
  createSafeStorageApiClient,
  SafeStorageService,
} from "./services/safeStorageClient.js";
import { sqsMessageHandler } from "./handlers/sqsMessageHandler.js";

const fileManager: FileManager = initFileManager(config);
const dynamoDBClient: DynamoDBClient = new DynamoDBClient();
const dbService: DbServiceBuilder = dbServiceBuilder(dynamoDBClient);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(safeStorageApiConfig);

const queueManager = initQueueManager({
  messageGroupId: "message_group_all_notification",
  logLevel: config.logLevel,
});

const handler = async (messagePayload: Message): Promise<void> => {
  await sqsMessageHandler(
    messagePayload,
    fileManager,
    dbService,
    safeStorageService
  );
};

await queueManager.runConsumer(
  handler,
  logger({ serviceName: config.serviceName }),
  {
    queueUrl: config.consumerQueueUrl,
    maxNumberOfMessages: config.maxNumberOfMessages,
    waitTimeSeconds: config.waitTimeSeconds,
    visibilityTimeout: config.visibilityTimeout,
    serviceName: config.serviceName,
  }
);
