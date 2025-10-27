import {
  FileManager,
  initFileManager,
  initQueueManager,
  logger,
  createSafeStorageApiClient,
  SafeStorageService,
  // SignatureServiceBuilder,
  // signatureServiceBuilder,
  RefreshableInteropToken,
  InteropTokenGenerator,
} from "pagopa-interop-commons";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Message } from "@aws-sdk/client-sqs";
import {
  SignatureServiceBuilder,
  signatureServiceBuilder,
} from "./services/signatureService.js";
import { config } from "./config/config.js";
import { sqsMessageHandler } from "./handlers/sqsMessageHandler.js";

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);
await refreshableToken.init();
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
    safeStorageService,
    refreshableToken
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
