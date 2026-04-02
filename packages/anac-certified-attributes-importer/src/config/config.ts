import {
  APIEndpoint,
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { SftpConfig } from "./sftpConfig.js";

const AnacCertifiedAttributesImporterConfig = LoggerConfig.and(
  ReadModelSQLDbConfig
)
  .and(SftpConfig)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        TENANT_PROCESS_URL: APIEndpoint,
        RECORDS_PROCESS_BATCH_SIZE: z.coerce.number(),
        ANAC_TENANT_ID: z.string(),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(1000),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(5),
      })
      .transform((c) => ({
        tenantProcessUrl: c.TENANT_PROCESS_URL,
        recordsProcessBatchSize: c.RECORDS_PROCESS_BATCH_SIZE,
        anacTenantId: c.ANAC_TENANT_ID,
        defaultPollingRetryDelay: c.DEFAULT_POLLING_RETRY_DELAY,
        defaultPollingMaxRetries: c.DEFAULT_POLLING_MAX_RETRIES,
      }))
  );

type AnacCertifiedAttributesImporterConfig = z.infer<
  typeof AnacCertifiedAttributesImporterConfig
>;

export const config: AnacCertifiedAttributesImporterConfig =
  AnacCertifiedAttributesImporterConfig.parse(process.env);
