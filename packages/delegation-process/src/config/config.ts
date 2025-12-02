import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  S3Config,
  FileManagerConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagDelegationsProcessContractBuilderConfig,
} from "pagopa-interop-commons";
import { PUBLIC_ADMINISTRATIONS_IDENTIFIER } from "pagopa-interop-models";
import { z } from "zod";

const DelegationDocumentConfig = z
  .object({
    DELEGATION_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    delegationDocumentPath: c.DELEGATION_DOCUMENTS_PATH,
  }));

const DelegationProcessConfig = CommonHTTPServiceConfig.and(
  ReadModelSQLDbConfig,
)
  .and(EventStoreConfig)
  .and(S3Config)
  .and(FileManagerConfig)
  .and(DelegationDocumentConfig)
  .and(FeatureFlagDelegationsProcessContractBuilderConfig)
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
      })),
  )
  .and(ApplicationAuditProducerConfig);

export type DelegationProcessConfig = z.infer<typeof DelegationProcessConfig>;
export const config: DelegationProcessConfig = DelegationProcessConfig.parse(
  process.env,
);
