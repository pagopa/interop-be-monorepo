import { z } from "zod";
import {
  FileManagerConfig,
  CommonHTTPServiceConfig,
  EventStoreConfig,
  S3Config,
  SelfCareClientConfig,
  ReadModelSQLDbConfig,
  ApplicationAuditProducerConfig,
} from "pagopa-interop-commons";

const AgreementProcessConfig = CommonHTTPServiceConfig.and(EventStoreConfig)
  .and(ReadModelSQLDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(SelfCareClientConfig)
  .and(
    z
      .object({
        CONSUMER_DOCUMENTS_PATH: z.string(),
        AGREEMENT_CONTRACTS_PATH: z.string(),
        JSON_BODY_LIMIT: z.string().default("10mb"),
      })
      .transform((c) => ({
        consumerDocumentsPath: c.CONSUMER_DOCUMENTS_PATH,
        agreementContractsPath: c.AGREEMENT_CONTRACTS_PATH,
        jsonBodyLimit: c.JSON_BODY_LIMIT,
      }))
  )
  .and(ApplicationAuditProducerConfig);

export type AgreementProcessConfig = z.infer<typeof AgreementProcessConfig>;
export const config: AgreementProcessConfig = AgreementProcessConfig.parse(
  process.env
);
