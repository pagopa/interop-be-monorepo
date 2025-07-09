import { EmailNotificationMessagePayload } from "pagopa-interop-models";
import { initProducer } from "kafka-iam-auth";
import { config } from "../config/config.js";
import { encodeEmailEvent } from "../handlers/utils.js";

const producer = await initProducer(config, config.emailSenderTopic);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function emailNotificationDispatcherServiceBuilder() {
  return {
    sendMessage: async (
      streamId: string,
      messagePayload: EmailNotificationMessagePayload
    ): Promise<void> => {
      await producer.send({
        messages: [
          {
            key: streamId,
            value: encodeEmailEvent(messagePayload),
          },
        ],
      });
    },
  };
}

export type NotificationEmailSenderService = ReturnType<
  typeof emailNotificationDispatcherServiceBuilder
>;
