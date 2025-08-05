/* eslint-disable no-constant-condition */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/immutable-data */
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SQSClientConfig,
  Message,
  SendMessageCommandInput,
} from "@aws-sdk/client-sqs";
import { InternalError } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { LoggerConfig } from "../config/loggerConfig.js";
import { genericLogger, Logger } from "../logging/index.js";
import { delay } from "../utils/delay.js";
import { validateSqsMessage } from "./queueManagerMessageValidation.js";
import { QueueMessage } from "./queueMessage.js";
import {
  queueManagerReceiveError,
  queueManagerSendError,
} from "./queueManagerErrors.js";

const serializeError = (error: unknown): string => {
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error));
  } catch (e) {
    return `${error}`;
  }
};

const processExit = async (exitStatusCode: number = 1): Promise<void> => {
  genericLogger.error(`Process exit with code ${exitStatusCode}`);
  await delay(1000);
  process.exit(exitStatusCode);
};

export const deleteMessage = async (
  sqsClient: SQSClient,
  consumerQueueUrl: string,
  receiptHandle: string
): Promise<void> => {
  const deleteCommand = new DeleteMessageCommand({
    QueueUrl: consumerQueueUrl,
    ReceiptHandle: receiptHandle,
  });
  await sqsClient.send(deleteCommand);
};

export type ConsumerConfig = {
  queueUrl: string;
  maxNumberOfMessages: number;
  waitTimeSeconds: number;
  visibilityTimeout: number;
  serviceName?: string;
};

export type QueueManager = {
  send: (
    queueUrl: string,
    message: QueueMessage,
    logger: Logger
  ) => Promise<string>;
  runConsumer: (
    consumerHandler: (messagePayload: Message) => Promise<void>,
    logger: Logger,
    consumerConfig: ConsumerConfig
  ) => Promise<void>;
  receiveLast: (
    queueUrl: string,
    logger: Logger,
    msgsToReceive?: number
  ) => Promise<QueueMessage[]>;
};

export function initQueueManager(
  config: { messageGroupId?: string } & LoggerConfig & Partial<SQSClientConfig>
): QueueManager {
  const client = new SQSClient({
    logger: config.logLevel === "debug" ? console : undefined,
    ...config,
  });

  return {
    send: async (
      queueUrl: string,
      message: QueueMessage,
      logger: Logger
    ): Promise<string> => {
      logger.debug(`Sending message ${message.spanId} to queue ${queueUrl}`);
      try {
        const messageCommandInput: SendMessageCommandInput = {
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(message),
          MessageAttributes: {
            correlationId: {
              DataType: "String",
              StringValue: message.correlationId,
            },
          },
        };

        if (config.messageGroupId) {
          messageCommandInput.MessageGroupId = config.messageGroupId;
        }

        const response = await client.send(
          new SendMessageCommand(messageCommandInput)
        );
        if (!response.MessageId) {
          throw new Error("Unexpected empty response from SQS");
        }

        return response.MessageId;
      } catch (error) {
        throw queueManagerSendError(queueUrl, error);
      }
    },

    runConsumer: async (
      consumerHandler: (messagePayload: Message) => Promise<void>,
      logger: Logger,
      consumerConfig: ConsumerConfig
    ): Promise<void> => {
      logger.info(`Consumer processing on Queue: ${consumerConfig.queueUrl}`);

      try {
        while (true) {
          const command = new ReceiveMessageCommand({
            QueueUrl: consumerConfig.queueUrl,
            MaxNumberOfMessages: consumerConfig.maxNumberOfMessages,
            MessageAttributeNames: ["All"],
            WaitTimeSeconds: consumerConfig.waitTimeSeconds,
            VisibilityTimeout: consumerConfig.visibilityTimeout,
          });

          const { Messages } = await client.send(command);

          if (Messages?.length) {
            for (const message of Messages) {
              try {
                const receiptHandle = message.ReceiptHandle;
                if (!receiptHandle) {
                  throw new Error(
                    `ReceiptHandle not found in Message: ${JSON.stringify(
                      message
                    )}`
                  );
                }

                const validationResult = validateSqsMessage(message, logger);
                await match(validationResult)
                  .with("SkipEvent", async () => {
                    await deleteMessage(
                      client,
                      consumerConfig.queueUrl,
                      receiptHandle
                    );
                  })
                  .with("ValidEvent", async () => {
                    await consumerHandler(message);
                    await deleteMessage(
                      client,
                      consumerConfig.queueUrl,
                      receiptHandle
                    );
                  })
                  .exhaustive();
              } catch (e) {
                logger.error(
                  `Unexpected error consuming message: ${JSON.stringify(
                    message
                  )}. QueueUrl: ${consumerConfig.queueUrl}. ${e}`
                );
                if (!(e instanceof InternalError)) {
                  throw e;
                }
              }
            }
          }
        }
      } catch (e) {
        logger.error(
          `Generic error occurs processing Queue: ${
            consumerConfig.queueUrl
          }. Details: ${serializeError(e)}`
        );
        await processExit();
      }
    },

    receiveLast: async (
      queueUrl: string,
      logger: Logger,
      msgsToReceive: number = 1
    ): Promise<QueueMessage[]> => {
      logger.debug(
        `Receiving last ${msgsToReceive} messages from queue ${queueUrl}`
      );
      try {
        const response = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: msgsToReceive,
          })
        );

        if (!response.Messages) {
          throw new Error("Unexpected empty response from SQS");
        }

        return (
          response.Messages?.map((message) => message.Body)
            .filter((body): body is string => body !== undefined)
            .map((body) => QueueMessage.parse(JSON.parse(body))) ?? undefined
        );
      } catch (error) {
        throw queueManagerReceiveError(queueUrl, error);
      }
    },
  };
}

export { QueueMessage, queueManagerSendError, queueManagerReceiveError };
