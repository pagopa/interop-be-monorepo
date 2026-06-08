import {
  APIEndpoint,
  FeatureFlagAttributeCertifiedDiscreteConfig,
  FileManagerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const IstatCertifiedDiscreteAttributesImporterConfig = LoggerConfig.and(
  FileManagerConfig
)
  .and(ReadModelSQLDbConfig)
  .and(TokenGenerationConfig)
  .and(FeatureFlagAttributeCertifiedDiscreteConfig)
  .and(
    z
      .object({
        TENANT_PROCESS_URL: APIEndpoint,
        ATTRIBUTE_PROCESS_URL: APIEndpoint,
        ISTAT_DOWNLOAD_URL: z.string(),
        CSV_CHUNK_SIZE: z.coerce.number().default(100),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(500),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(5),
      })
      .transform((c) => ({
        tenantProcessUrl: c.TENANT_PROCESS_URL,
        attributeProcessUrl: c.ATTRIBUTE_PROCESS_URL,
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
