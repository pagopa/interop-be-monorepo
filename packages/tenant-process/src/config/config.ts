import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagDelegationConstraintSkipConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TenantProcessConfig = CommonHTTPServiceConfig.and(EventStoreConfig)
  .and(ReadModelSQLDbConfig)
  .and(FeatureFlagDelegationConstraintSkipConfig)
  // The internal token authenticates the calls to the Contact Data Manager
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        DELEGATIONS_ALLOWED_ATTRIBUTE_ID: z.string().uuid(),
        CONTACT_DATA_MANAGER_URL: z.string(),
      })
      .transform((c) => ({
        delegationsAllowedAttributeId: c.DELEGATIONS_ALLOWED_ATTRIBUTE_ID,
        contactDataManagerUrl: c.CONTACT_DATA_MANAGER_URL,
      }))
  )
  .and(ApplicationAuditProducerConfig);

type TenantProcessConfig = z.infer<typeof TenantProcessConfig>;

export const config: TenantProcessConfig = TenantProcessConfig.parse(
  process.env
);
