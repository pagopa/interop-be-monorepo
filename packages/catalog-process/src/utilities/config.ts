import {
  CommonConfig,
  ReadModelDbConfig,
  FileManagerConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CataloProcessConfig = CommonConfig.and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(EventStoreConfig)
  .and(
    z
      .object({
        STORAGE_CONTAINER: z.string(),
        ESERVICE_DOCUMENTS_PATH: z.string(),
      })
      .transform((c) => ({
        storageContainer: c.STORAGE_CONTAINER,
        eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
      }))
  );

export type CatalogProcessConfig = z.infer<typeof CataloProcessConfig>;

export const config: CatalogProcessConfig = {
  ...CataloProcessConfig.parse(process.env),
};
