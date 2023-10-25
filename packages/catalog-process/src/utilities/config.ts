import {
  CommonConfig,
  ReadModelDbConfig,
  FileManagerConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CataloProcessConfig = CommonConfig.and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(EventStoreConfig);

export type CatalogProcessConfig = z.infer<typeof CataloProcessConfig>;

export const config: CatalogProcessConfig = {
  ...CataloProcessConfig.parse(process.env),
};
