import {
  AgreementTopicConfig,
  AuthorizationTopicConfig,
  CatalogTopicConfig,
  KafkaConsumerConfig,
  LoggerConfig,
  PurposeTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const NotificationQueueConfig = z
  .object({
    NOTIFICATION_QUEUE_URL: z.string(),
  })
  .transform((c) => ({
    queueUrl: c.NOTIFICATION_QUEUE_URL,
  }));
type NotificationQueueConfig = z.infer<typeof NotificationQueueConfig>;

const NotifierSeederConfig = KafkaConsumerConfig.and(CatalogTopicConfig)
  .and(PurposeTopicConfig)
  .and(AgreementTopicConfig)
  .and(AuthorizationTopicConfig)
  .and(LoggerConfig)
  .and(NotificationQueueConfig);

type NotifierSeederConfig = z.infer<typeof NotifierSeederConfig>;

export const config: NotifierSeederConfig = NotifierSeederConfig.parse(
  process.env
);
