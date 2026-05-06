import {
  APIEndpoint,
  CommonHTTPServiceConfig,
  EventStoreConfig,
  FileManagerConfig,
  S3Config,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagPurposeTemplateConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig = CommonHTTPServiceConfig.and(ReadModelSQLDbConfig)
  .and(EventStoreConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(
    z
      .object({
        RISK_ANALYSIS_DOCUMENTS_PATH: z.string(),
        RISK_ANALYSIS_PROCESS_URL: APIEndpoint,
      })
      .transform((c) => ({
        riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENTS_PATH,
        riskAnalysisProcessUrl: c.RISK_ANALYSIS_PROCESS_URL,
      }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagPurposeTemplateConfig);

type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = PurposeProcessConfig.parse(
  process.env
);
