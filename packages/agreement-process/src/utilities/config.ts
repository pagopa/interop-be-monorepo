import { z } from "zod";
import {
  FileManagerConfig,
  CommonConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";

const AgreementProcessConfig = CommonConfig.and(EventStoreConfig)
  .and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(
    z
      .object({
        STORAGE_CONTAINER: z.string(),
        CONSUMER_DOCUMENTS_PATH: z.string(),
      })
      .transform((c) => ({
        storageContainer: c.STORAGE_CONTAINER,
        consumerDocumentsPath: c.CONSUMER_DOCUMENTS_PATH,
      }))
  );
export type AgreementProcessConfig = z.infer<typeof AgreementProcessConfig>;

export const config: AgreementProcessConfig = {
  ...AgreementProcessConfig.parse(process.env),
};
