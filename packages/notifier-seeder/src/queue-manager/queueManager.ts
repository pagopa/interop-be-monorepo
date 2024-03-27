import {
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { LoggerConfig, logger } from "pagopa-interop-commons";
import {
  queueManagerReceiveError,
  queueManagerSendError,
} from "./queueManagerErrors.js";
import { QueueMessage } from "./queueMessage.js";

export type QueueManager = {
  send: (message: QueueMessage) => Promise<string>;
  receiveLast: (msgsToReceive?: number) => Promise<QueueMessage[]>;
};

export function initQueueManager(
  config: { queueUrl: string; messageGroupId: string } & LoggerConfig
): QueueManager {
  const client = new SQSClient({
    logger: config.logLevel === "debug" ? console : undefined,
  });

  return {
    send: async (message: QueueMessage): Promise<string> => {
      logger.debug(
        `Sending message ${message.messageUUID} to queue ${config.queueUrl}`
      );
      try {
        const response = await client.send(
          new SendMessageCommand({
            QueueUrl: config.queueUrl,
            MessageBody: JSON.stringify(message, (_, v) =>
              typeof v === "bigint" ? v.toString() : v
            ),
            MessageGroupId: config.messageGroupId,
            MessageDeduplicationId: `${message.eventJournalPersistenceId}_${message.eventJournalSequenceNumber}`,
          })
        );
        if (!response.MessageId) {
          throw new Error("Unexpected empty response from SQS");
        }
        return response.MessageId;
      } catch (error) {
        throw queueManagerSendError(config.queueUrl, error);
      }
    },
    receiveLast: async (msgsToReceive: number = 1): Promise<QueueMessage[]> => {
      logger.debug(
        `Receiving last ${msgsToReceive} messages from queue ${config.queueUrl}`
      );
      try {
        const response = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: config.queueUrl,
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
        throw queueManagerReceiveError(config.queueUrl, error);
      }
    },
  };
}
