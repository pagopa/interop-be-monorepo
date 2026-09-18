import {
  AttributeRegistryProcessServerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
  TenantProcessServerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PrivateCertifiedAttributesImporterConfig = LoggerConfig.and(
  ReadModelSQLDbConfig
)
  .and(TokenGenerationConfig)
  .and(TenantProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(
    z
      .object({
        ATTRIBUTE_CREATION_WAIT_TIME: z.coerce.number(),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(1000),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(50),
      })
      .transform((c) => ({
        attributeCreationWaitTime: c.ATTRIBUTE_CREATION_WAIT_TIME,
        defaultPollingRetryDelay: c.DEFAULT_POLLING_RETRY_DELAY,
        defaultPollingMaxRetries: c.DEFAULT_POLLING_MAX_RETRIES,
      }))
  );

type PrivateCertifiedAttributesImporterConfig = z.infer<
  typeof PrivateCertifiedAttributesImporterConfig
>;

export const config: PrivateCertifiedAttributesImporterConfig =
  PrivateCertifiedAttributesImporterConfig.parse(process.env);
