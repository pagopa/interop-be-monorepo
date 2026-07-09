import {
  APIEndpoint,
  CatalogTopicConfig,
  DelegationTopicConfig,
  TokenGenerationConfig,
  KafkaConsumerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const DelegateDescriptorsArchivingRequestsRejecterConfig =
  KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(ReadModelSQLDbConfig)
  .and(CatalogTopicConfig)
  .and(DelegationTopicConfig)
  .and(
    z
      .object({
        CATALOG_PROCESS_URL: APIEndpoint,
      })
      .transform((c) => ({
        catalogProcessUrl: c.CATALOG_PROCESS_URL,
      }))
  );

type DelegateDescriptorsArchivingRequestsRejecterConfig = z.infer<
  typeof DelegateDescriptorsArchivingRequestsRejecterConfig
>;

export const config: DelegateDescriptorsArchivingRequestsRejecterConfig =
  DelegateDescriptorsArchivingRequestsRejecterConfig.parse(process.env);
