import {
  APIEndpoint,
  KafkaConsumerConfig,
  EServiceTemplateTopicConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const CatalogProcessServerConfig = z
  .object({
    CATALOG_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    catalogUrl: c.CATALOG_PROCESS_URL,
  }));

export const EServiceTemplateProcessServerConfig = z
  .object({
    ESERVICE_TEMPLATE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    eserviceTemplateUrl: c.ESERVICE_TEMPLATE_PROCESS_URL,
  }));

const EServiceTemplateUpdaterConfig = CatalogProcessServerConfig.and(
  EServiceTemplateProcessServerConfig
)
  .and(EServiceTemplateTopicConfig)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig);

export type EServiceTemplateUpdaterConfig = z.infer<
  typeof EServiceTemplateUpdaterConfig
>;
export const config: EServiceTemplateUpdaterConfig =
  EServiceTemplateUpdaterConfig.parse(process.env);
