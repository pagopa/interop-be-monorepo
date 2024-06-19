import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AuthorizationConfig =
  CommonHTTPServiceConfig.and(ReadModelDbConfig).and(EventStoreConfig);

export type AuthorizationConfig = z.infer<typeof AuthorizationConfig>;

export const config: AuthorizationConfig = AuthorizationConfig.parse(
  process.env
);
