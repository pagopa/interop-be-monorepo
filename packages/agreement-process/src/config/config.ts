import { z } from "zod";
import {
  FileManagerConfig,
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  S3Config,
  SelfCareConfig,
  FeatureFlagSQL,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";

const AgreementProcessConfig = CommonHTTPServiceConfig.and(EventStoreConfig)
  .and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(SelfCareConfig)
  .and(
    z
      .object({
        CONSUMER_DOCUMENTS_PATH: z.string(),
        AGREEMENT_CONTRACTS_PATH: z.string(),
      })
      .transform((c) => ({
        consumerDocumentsPath: c.CONSUMER_DOCUMENTS_PATH,
        agreementContractsPath: c.AGREEMENT_CONTRACTS_PATH,
      }))
  )
  .and(FeatureFlagSQL)
  .and(ReadModelSQLDbConfig.optional());

export type AgreementProcessConfig = z.infer<typeof AgreementProcessConfig>;

export const config: AgreementProcessConfig = AgreementProcessConfig.parse(
  process.env
);
