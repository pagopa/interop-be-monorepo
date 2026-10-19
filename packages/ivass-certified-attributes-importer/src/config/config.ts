import {
  APIEndpoint,
  FileManagerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const IvassCertifiedAttributesImporterConfig = LoggerConfig.and(
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
        RECORDS_PROCESS_BATCH_SIZE: z.coerce.number(),
        IVASS_TENANT_ID: z.string(),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(1000),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(5),
      })
      .transform((c) => ({
        sourceUrl: c.SOURCE_URL,
        historyBucketName: c.HISTORY_BUCKET_NAME,
        tenantProcessUrl: c.TENANT_PROCESS_URL,
        recordsProcessBatchSize: c.RECORDS_PROCESS_BATCH_SIZE,
        ivassTenantId: c.IVASS_TENANT_ID,
        defaultPollingRetryDelay: c.DEFAULT_POLLING_RETRY_DELAY,
        defaultPollingMaxRetries: c.DEFAULT_POLLING_MAX_RETRIES,
      }))
  );

type IvassCertifiedAttributesImporterConfig = z.infer<
  typeof IvassCertifiedAttributesImporterConfig
>;

export const config: IvassCertifiedAttributesImporterConfig =
  IvassCertifiedAttributesImporterConfig.parse(process.env);
