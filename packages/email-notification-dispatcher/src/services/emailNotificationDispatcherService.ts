import { EmailNotificationMessagePayload } from "pagopa-interop-models";
import { initProducer } from "kafka-iam-auth";
import { logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { encodeEmailEvent } from "./utils.js";

const producer = await initProducer(
  config,
  config.emailSenderTopic,
  config.producerKafkaTransactionalId
);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function emailNotificationDispatcherServiceBuilder() {
  return {
    sendMessages: async (
      messagePayloads: EmailNotificationMessagePayload[]
    ): Promise<void> => {
      const transaction = await producer.transaction();
      try {
        await producer.send({
          messages: messagePayloads.map((payload) => ({
            value: encodeEmailEvent(payload),
          })),
        });
        await transaction.commit();
      } catch (e) {
        logger({ serviceName: "email-notification-dispatcher" }).info(
          `Error while sending messages. Transaction will be aborted. Affected correlationIds: ` +
            messagePayloads.map((payload) => payload.correlationId).join(", ")
        );
        await transaction.abort();
      }
    },
  };
}

export type NotificationEmailSenderService = ReturnType<
  typeof emailNotificationDispatcherServiceBuilder
>;
