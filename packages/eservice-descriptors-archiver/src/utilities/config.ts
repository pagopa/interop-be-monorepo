import {
  AgreementTopicConfig,
  TokenGenerationConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EserviceDescriptorsArchiverConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelDbConfig)
  .and(AgreementTopicConfig)
  .and(
    z
      .object({
        CATALOG_PROCESS_URL: z.string(),
      })
      .transform((c) => ({
        catalogProcessUrl: c.CATALOG_PROCESS_URL,
      }))
  );

export type EserviceDescriptorsArchiverConfig = z.infer<
  typeof EserviceDescriptorsArchiverConfig
>;

export const config: EserviceDescriptorsArchiverConfig =
  EserviceDescriptorsArchiverConfig.parse(process.env);
