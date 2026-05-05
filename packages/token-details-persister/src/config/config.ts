import {
  FileManagerConfig,
  KafkaBatchConsumerConfig,
  KafkaConsumerConfig,
  LoggerConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const TokenDetailsPersisterConfig = FileManagerConfig.and(S3Config)
  .and(KafkaConsumerConfig)
  .and(KafkaBatchConsumerConfig)
  .and(LoggerConfig)
  .and(
    z
      .object({
        TOKEN_AUDITING_TOPIC: z.string(),
      })
      .transform((c) => ({
        tokenAuditingTopic: c.TOKEN_AUDITING_TOPIC,
      }))
  );

type TokenDetailsPersisterConfig = z.infer<typeof TokenDetailsPersisterConfig>;

export const config: TokenDetailsPersisterConfig =
  TokenDetailsPersisterConfig.parse(process.env);

export const baseConsumerConfig: KafkaConsumerConfig =
  KafkaConsumerConfig.parse(process.env);

export const batchConsumerConfig: KafkaBatchConsumerConfig =
  KafkaBatchConsumerConfig.parse(process.env);
