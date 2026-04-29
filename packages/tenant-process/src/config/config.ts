import { z } from "zod";
import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagDelegationConstraintSkipConfig,
} from "pagopa-interop-commons";

const TenantProcessConfig = CommonHTTPServiceConfig.and(EventStoreConfig)
  .and(ReadModelSQLDbConfig)
  .and(FeatureFlagDelegationConstraintSkipConfig)
  .and(
    z
      .object({
        DELEGATIONS_ALLOWED_ATTRIBUTE_ID: z.string().uuid(),
      })
      .transform((c) => ({
        delegationsAllowedAttributeId: c.DELEGATIONS_ALLOWED_ATTRIBUTE_ID,
      }))
  )
  .and(ApplicationAuditProducerConfig);

type TenantProcessConfig = z.infer<typeof TenantProcessConfig>;

export const config: TenantProcessConfig = TenantProcessConfig.parse(
  process.env
);
