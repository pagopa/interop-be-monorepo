import { z } from "zod";
import {
  FileManagerConfig,
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  S3Config,
} from "pagopa-interop-commons";
import { SelfCareConfig } from "pagopa-interop-selfcare-v2-client";

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
  );
export type AgreementProcessConfig = z.infer<typeof AgreementProcessConfig>;

export const config: AgreementProcessConfig = {
  ...AgreementProcessConfig.parse(process.env),
};
