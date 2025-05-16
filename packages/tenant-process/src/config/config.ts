import { z } from "zod";
import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  ApplicationAuditProducerConfig,
  FeatureFlagSQLConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { PUBLIC_ADMINISTRATIONS_IDENTIFIER } from "pagopa-interop-models";

const TenantProcessConfig = CommonHTTPServiceConfig.and(EventStoreConfig)
  .and(ReadModelDbConfig)
  .and(
    z
      .object({
        DELEGATIONS_ALLOWED_ORIGINS: z
          .string()
          .optional()
          .default(PUBLIC_ADMINISTRATIONS_IDENTIFIER),
      })
      .transform((c) => ({
        delegationsAllowedOrigins: c.DELEGATIONS_ALLOWED_ORIGINS.split(","),
      }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagSQLConfig.optional())
  .and(ReadModelSQLDbConfig.optional());

export type TenantProcessConfig = z.infer<typeof TenantProcessConfig>;

export const config: TenantProcessConfig = TenantProcessConfig.parse(
  process.env
);
