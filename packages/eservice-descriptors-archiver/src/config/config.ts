import {
  AgreementTopicConfig,
  CatalogProcessServerConfig,
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
  .and(CatalogProcessServerConfig);

type EserviceDescriptorsArchiverConfig = z.infer<
  typeof EserviceDescriptorsArchiverConfig
>;

export const config: EserviceDescriptorsArchiverConfig =
  EserviceDescriptorsArchiverConfig.parse(process.env);
