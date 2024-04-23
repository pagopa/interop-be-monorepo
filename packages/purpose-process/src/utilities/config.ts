import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig =
  CommonHTTPServiceConfig.and(ReadModelDbConfig).and(EventStoreConfig);

export type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = {
  ...PurposeProcessConfig.parse(process.env),
};
