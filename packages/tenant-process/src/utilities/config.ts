import { z } from "zod";
import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";

const TenantProcessConfig =
  CommonHTTPServiceConfig.and(EventStoreConfig).and(ReadModelDbConfig);
export type TenantProcessConfig = z.infer<typeof TenantProcessConfig>;

export const config: TenantProcessConfig = {
  ...TenantProcessConfig.parse(process.env),
};
