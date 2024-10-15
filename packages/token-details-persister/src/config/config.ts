import {
  FileManagerConfig,
  KafkaConsumerConfig,
  LoggerConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

export const TokenDetailsPersisterConfig = FileManagerConfig.and(S3Config)
  .and(KafkaConsumerConfig)
  .and(LoggerConfig);

export type TokenDetailsPersisterConfig = z.infer<
  typeof TokenDetailsPersisterConfig
>;

export const config: TokenDetailsPersisterConfig =
  TokenDetailsPersisterConfig.parse(process.env);
