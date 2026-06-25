import {
  FileManager,
  initFileManager,
  initQueueManager,
  logger,
  createSafeStorageApiClient,
  SafeStorageService,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Message } from "@aws-sdk/client-sqs";
import {
  SignatureServiceBuilder,
  signatureServiceBuilder,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { sqsMessageHandler } from "./handlers/sqsMessageHandler.js";

const fileManager: FileManager = initFileManager(config);
const dynamoDBClient: DynamoDBClient = new DynamoDBClient();
const signatureService: SignatureServiceBuilder = signatureServiceBuilder(
  dynamoDBClient,
  config
);
const safeStorageService: SafeStorageService =
  createSafeStorageApiClient(config);

const queueManager = initQueueManager({
  messageGroupId: "message_group_all_notification",
  logLevel: config.logLevel,
});

const handler = async (messagePayload: Message): Promise<void> => {
  await sqsMessageHandler(
    messagePayload,
    fileManager,
    signatureService,
    safeStorageService
  );
};

await queueManager.runConsumer(
  handler,
  logger({ serviceName: "audit-signer" }),
  {
    queueUrl: config.consumerQueueUrl,
    maxNumberOfMessages: config.maxNumberOfMessages,
    waitTimeSeconds: config.waitTimeSeconds,
    visibilityTimeout: config.visibilityTimeout,
    serviceName: "audit-signer",
  }
);
