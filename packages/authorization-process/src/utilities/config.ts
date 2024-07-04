import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { SelfCareConfig } from "pagopa-interop-selfcare-v2-client";
import { z } from "zod";

const AuthorizationConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(EventStoreConfig)
  .and(SelfCareConfig);
export type AuthorizationConfig = z.infer<typeof AuthorizationConfig>;

export const config: AuthorizationConfig = {
  ...AuthorizationConfig.parse(process.env),
};
