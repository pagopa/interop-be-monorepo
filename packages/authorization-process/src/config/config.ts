import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  SelfCareClientConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AuthorizationConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(EventStoreConfig)
  .and(SelfCareClientConfig)
  .and(
    z
      .object({
        MAX_KEYS_PER_CLIENT: z.coerce.number(),
        MAX_KEYS_PER_PRODUCER_KEYCHAIN: z.coerce.number(),
      })
      .transform((c) => ({
        maxKeysPerClient: c.MAX_KEYS_PER_CLIENT,
        maxKeysPerProducerKeychain: c.MAX_KEYS_PER_PRODUCER_KEYCHAIN,
      }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(ReadModelSQLDbConfig);

export type AuthorizationConfig = z.infer<typeof AuthorizationConfig>;

export const config: AuthorizationConfig = AuthorizationConfig.parse(
  process.env
);
