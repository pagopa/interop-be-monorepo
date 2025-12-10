import { initProducer } from "kafka-iam-auth";
import {
  CorrelationId,
  EmailNotificationMessagePayload,
  generateId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";

export type KafkaProducer = Awaited<ReturnType<typeof initProducer>>;

export type EmailProducerService = {
  sendDigestEmail: (
    message: EmailNotificationMessagePayload,
    logger: Logger
  ) => Promise<void>;
  disconnect: () => Promise<void>;
};

export function emailProducerServiceBuilder(
  producer: KafkaProducer
): EmailProducerService {
  return {
    async sendDigestEmail(
      message: EmailNotificationMessagePayload,
      logger: Logger
    ): Promise<void> {
      await producer.send({
        messages: [
          {
            key: message.tenantId,
            value: JSON.stringify(message),
          },
        ],
      });

      logger.info(`Successfully sent digest email to Kafka`);
    },

    async disconnect(): Promise<void> {
      await producer.disconnect();
    },
  };
}

/**
 * Creates an EmailNotificationMessagePayload for a digest email
 */
export function createDigestEmailPayload(
  userId: UserId,
  tenantId: TenantId,
  emailBody: string,
  correlationId?: CorrelationId
): EmailNotificationMessagePayload {
  return {
    type: "User",
    correlationId: correlationId ?? generateId<CorrelationId>(),
    userId,
    tenantId,
    email: {
      subject: "Riepilogo notifiche PDND Interoperabilità",
      body: emailBody,
    },
  };
}
