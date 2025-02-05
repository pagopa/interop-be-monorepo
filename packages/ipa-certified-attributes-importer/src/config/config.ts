import {
  APIEndpoint,
  LoggerConfig,
  ReadModelDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const TenantProcessServerConfig = z
  .object({
    TENANT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    tenantProcessUrl: c.TENANT_PROCESS_URL,
  }));
export type TenantProcessServerConfig = z.infer<
  typeof TenantProcessServerConfig
>;

export const AttributeRegistryProcessServerConfig = z
  .object({
    ATTRIBUTE_REGISTRY_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    attributeRegistryUrl: c.ATTRIBUTE_REGISTRY_PROCESS_URL,
  }));
export type AttributeRegistryProcessServerConfig = z.infer<
  typeof AttributeRegistryProcessServerConfig
>;

export const IPACertifiedAttributesImporterConfig = LoggerConfig.and(
  ReadModelDbConfig
)
  .and(TokenGenerationConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(TenantProcessServerConfig)
  .and(
    z
      .object({
        INSTITUTIONS_URL: APIEndpoint,
        AOO_URL: APIEndpoint,
        UO_URL: APIEndpoint,
        INSTITUTIONS_CATEGORIES_URL: APIEndpoint,
        ATTRIBUTE_CREATION_WAIT_TIME: z.coerce.number(),
      })
      .transform((c) => ({
        institutionsUrl: c.INSTITUTIONS_URL,
        aooUrl: c.AOO_URL,
        uoUrl: c.UO_URL,
        institutionsCategoriesUrl: c.INSTITUTIONS_CATEGORIES_URL,
        attributeCreationWaitTime: c.ATTRIBUTE_CREATION_WAIT_TIME,
      }))
  );

export type IPACertifiedAttributesImporterConfig = z.infer<
  typeof IPACertifiedAttributesImporterConfig
>;

export const config: IPACertifiedAttributesImporterConfig =
  IPACertifiedAttributesImporterConfig.parse(process.env);
