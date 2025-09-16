import {
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { M2MEventSQLDbConfig } from "pagopa-interop-commons";

const M2MEventsManagerConfig = CommonHTTPServiceConfig.and(
  ApplicationAuditProducerConfig
).and(M2MEventSQLDbConfig);

export type M2MEventsManagerConfig = z.infer<typeof M2MEventsManagerConfig>;

export const config: M2MEventsManagerConfig = M2MEventsManagerConfig.parse(
  process.env
);
