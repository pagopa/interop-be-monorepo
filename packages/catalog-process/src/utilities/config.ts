import { CommonConfig, ReadModelDbConfig } from "pagopa-interop-commons";
import { z } from "zod";
import {
  CommonConfig,
  HTTPServerConfig,
  FileManagerConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";

const CataloProcessConfig = CommonConfig.and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(EventStoreConfig);

export type CataloProcessConfig = z.infer<typeof CataloProcessConfig>;

export const config: CataloProcessConfig = {
  ...CataloProcessConfig.parse(process.env),
};
