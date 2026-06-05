import {
  APIEndpoint,
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
  .and(
    z
      .object({
        SOURCE_URL: z.string(),
        HISTORY_BUCKET_NAME: z.string(),
        TENANT_PROCESS_URL: APIEndpoint,
        ATTRIBUTE_PROCESS_URL: APIEndpoint,
        ISTAT_DOWNLOAD_URL: z.string(),
        RECORDS_PROCESS_BATCH_SIZE: z.coerce.number(),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(1000),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(5),
      })
      .transform((c) => ({
        sourceUrl: c.SOURCE_URL,
        historyBucketName: c.HISTORY_BUCKET_NAME,
        tenantProcessUrl: c.TENANT_PROCESS_URL,
        attributeProcessUrl: c.ATTRIBUTE_PROCESS_URL,
        istatDownloadUrl: c.ISTAT_DOWNLOAD_URL,
        recordsProcessBatchSize: c.RECORDS_PROCESS_BATCH_SIZE,
        defaultPollingRetryDelay: c.DEFAULT_POLLING_RETRY_DELAY,
        defaultPollingMaxRetries: c.DEFAULT_POLLING_MAX_RETRIES,
      }))
  );

type IstatCertifiedDiscreteAttributesImporterConfig = z.infer<
  typeof IstatCertifiedDiscreteAttributesImporterConfig
>;

export const config: IstatCertifiedDiscreteAttributesImporterConfig =
  IstatCertifiedDiscreteAttributesImporterConfig.parse(process.env);
