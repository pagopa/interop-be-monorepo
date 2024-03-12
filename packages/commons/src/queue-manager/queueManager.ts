import {
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { LoggerConfig, logger } from "../index.js";
import { QueueMessage } from "./models.js";

export type QueueManager = {
  send: (message: QueueMessage) => Promise<string>;
  receiveLast: (msgsToReceive?: number) => Promise<QueueMessage[]>;
};

export function initQueueManager(
  // TODO dedicated config type?
  config: { queueUrl: string } & LoggerConfig
): QueueManager {
  const constantMessageGroupId = "message_group_all_notification";
  const client = new SQSClient({
    logger: config.logLevel === "debug" ? console : undefined,
  });

  return {
    send: async (message: QueueMessage): Promise<string> => {
      logger.info(
        `Sending message ${message.messageUUID} to queue ${config.queueUrl}`
      );
      const response = await client.send(
        new SendMessageCommand({
          QueueUrl: config.queueUrl,
          MessageBody: JSON.stringify(message),
          MessageGroupId: constantMessageGroupId,
          MessageDeduplicationId: `${message.eventJournalPersistenceId}_${message.eventJournalSequenceNumber}`,
        })
      );
      if (!response.MessageId) {
        throw new Error("TODO");
      }
      return response.MessageId;
      // TODO define dedicated error & try catch
    },
    receiveLast: async (msgsToReceive: number = 1): Promise<QueueMessage[]> => {
      logger.info(
        `Receiving last ${msgsToReceive} messages from queue ${config.queueUrl}`
      );
      const response = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: config.queueUrl,
          MaxNumberOfMessages: msgsToReceive,
        })
      );
      return (
        response.Messages?.map((message) => message.Body)
          .filter((body): body is string => body !== undefined)
          .map((body) => QueueMessage.parse(JSON.parse(body))) ?? []
      );
      // TODO define dedicated error & try catch
    },
  };
}
