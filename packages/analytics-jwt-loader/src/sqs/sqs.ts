import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
  SQSClientConfig,
} from "@aws-sdk/client-sqs";
import { genericLogger, logger } from "pagopa-interop-commons";
import { AnalyticsJwTLoaderConfig } from "../config/config.js";

const processExit = async (exitStatusCode: number = 1): Promise<void> => {
  genericLogger.error(`Process exit with code ${exitStatusCode}`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  process.exit(exitStatusCode);
};

export const instantiateClient = (config: SQSClientConfig): SQSClient =>
  new SQSClient(config);

const processQueue = async (
  sqsClient: SQSClient,
  config: {
    queueUrl: string;
    runUntilQueueIsEmpty?: boolean;
  } & AnalyticsJwTLoaderConfig,
  consumerHandler: (messagePayload: Message) => Promise<void>,
): Promise<void> => {
  const command = new ReceiveMessageCommand({
    QueueUrl: config.queueUrl,
    WaitTimeSeconds: config.consumerPollingTimeout,
  });
  // eslint-disable-next-line functional/no-let
  let keepProcessingQueue: boolean = true;

  do {
    const { Messages } = await sqsClient.send(command);
    if (config.runUntilQueueIsEmpty && (!Messages || Messages?.length === 0)) {
      keepProcessingQueue = false;
    }

    if (Messages?.length) {
      for (const message of Messages) {
        if (!message.ReceiptHandle) {
          throw new Error(
            `ReceiptHandle not found in Message: ${JSON.stringify(message)}`,
          );
        }

        try {
          await consumerHandler(message);
          await deleteMessage(
            sqsClient,
            config.queueUrl,
            message.ReceiptHandle,
          );
        } catch (e) {
          genericLogger.error(
            `Unexpected error consuming message: ${JSON.stringify(
              message,
            )}. QueueUrl: ${config.queueUrl}. ${e}`,
          );
        }
      }
    }
  } while (keepProcessingQueue);
};

export const runConsumer = async (
  sqsClient: SQSClient,
  config: AnalyticsJwTLoaderConfig,
  consumerHandler: (messagePayload: Message) => Promise<void>,
): Promise<void> => {
  logger({ serviceName: config.serviceName }).info(
    `Consumer processing on Queue: ${config.queueUrl}`,
  );

  try {
    await processQueue(sqsClient, config, consumerHandler);
  } catch (e) {
    logger({ serviceName: config.serviceName }).error(
      `Generic error occurs processing Queue: ${config.queueUrl}. Details: ${e}`,
    );
    await processExit();
  }

  logger({ serviceName: config.serviceName }).info(
    `Queue processing Completed for Queue: ${config.queueUrl}`,
  );
};

export const deleteMessage = async (
  sqsClient: SQSClient,
  queueUrl: string,
  receiptHandle: string,
): Promise<void> => {
  const deleteCommand = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  });

  await sqsClient.send(deleteCommand);
};
