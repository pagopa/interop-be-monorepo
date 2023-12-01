import { z } from "zod";
import {
  CommonConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";

const TenantProcessConfig =
  CommonConfig.and(EventStoreConfig).and(ReadModelDbConfig);
export type TenantProcessConfig = z.infer<typeof TenantProcessConfig>;

export const config: TenantProcessConfig = {
  ...TenantProcessConfig.parse(process.env),
};
