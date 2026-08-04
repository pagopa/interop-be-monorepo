import {
  AgreementTopicConfig,
  CatalogTopicConfig,
  DelegationTopicConfig,
  TokenGenerationConfig,
  KafkaConsumerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const EserviceDescriptorsArchiverConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelSQLDbConfig)
  .and(AgreementTopicConfig)
  .and(CatalogTopicConfig)
  .and(DelegationTopicConfig)
  .and(
    z
      .object({
        CATALOG_PROCESS_URL: z.string(),
      })
      .transform((c) => ({
        catalogProcessUrl: c.CATALOG_PROCESS_URL,
      }))
  );

type EserviceDescriptorsArchiverConfig = z.infer<
  typeof EserviceDescriptorsArchiverConfig
>;

export const config: EserviceDescriptorsArchiverConfig =
  EserviceDescriptorsArchiverConfig.parse(process.env);
