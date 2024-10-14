import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const DelegationProcessConfig =
  CommonHTTPServiceConfig.and(ReadModelDbConfig).and(EventStoreConfig);

export type DelegationProcessConfig = z.infer<typeof DelegationProcessConfig>;
export const config: DelegationProcessConfig = DelegationProcessConfig.parse(
  process.env
);
