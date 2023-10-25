import {
  CommonConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CataloProcessConfig =
  CommonConfig.and(ReadModelDbConfig).and(EventStoreConfig);

export type CatalogProcessConfig = z.infer<typeof CataloProcessConfig>;

export const config: CatalogProcessConfig = {
  ...CataloProcessConfig.parse(process.env),
};
