import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  FileManagerConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig = CommonHTTPServiceConfig.and(EventStoreConfig)
  .and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(S3Config);

export type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = {
  ...PurposeProcessConfig.parse(process.env),
};
