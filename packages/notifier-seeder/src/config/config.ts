import {
  AgreementTopicConfig,
  AuthorizationTopicConfig,
  CatalogTopicConfig,
  KafkaConsumerConfig,
  LoggerConfig,
  PurposeTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const NotificationQueueConfig = z
  .object({
    NOTIFICATION_QUEUE_URL: z.string(),
  })
  .transform((c) => ({
    queueUrl: c.NOTIFICATION_QUEUE_URL,
  }));
export type NotificationQueueConfig = z.infer<typeof NotificationQueueConfig>;

export const NotifierSeederConfig = KafkaConsumerConfig.and(CatalogTopicConfig)
  .and(PurposeTopicConfig)
  .and(AgreementTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(LoggerConfig)
  .and(NotificationQueueConfig);

export type NotifierSeederConfig = z.infer<typeof NotifierSeederConfig>;

export const config: NotifierSeederConfig = NotifierSeederConfig.parse(
  process.env
);
