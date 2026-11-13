import {
  AttributeRegistryProcessServerConfig,
  FeatureFlagAttributeCertifiedDiscreteConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
  TenantProcessServerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const IstatCertifiedDiscreteAttributesImporterConfig = LoggerConfig.and(
  ReadModelSQLDbConfig
)
  .and(TokenGenerationConfig)
  .and(FeatureFlagAttributeCertifiedDiscreteConfig)
  .and(TenantProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(
    z
      .object({
        ISTAT_DOWNLOAD_URL: z.string(),
        CSV_CHUNK_SIZE: z.coerce.number().default(100),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(500),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(5),
      })
      .transform((c) => ({
        istatDownloadUrl: c.ISTAT_DOWNLOAD_URL,
        csvChunkSize: c.CSV_CHUNK_SIZE,
        defaultPollingRetryDelay: c.DEFAULT_POLLING_RETRY_DELAY,
        defaultPollingMaxRetries: c.DEFAULT_POLLING_MAX_RETRIES,
      }))
  );

type IstatCertifiedDiscreteAttributesImporterConfig = z.infer<
  typeof IstatCertifiedDiscreteAttributesImporterConfig
>;

export const config: IstatCertifiedDiscreteAttributesImporterConfig =
  IstatCertifiedDiscreteAttributesImporterConfig.parse(process.env);
