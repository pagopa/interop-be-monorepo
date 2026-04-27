import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  S3Config,
  FileManagerConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagDelegationsProcessContractBuilderConfig,
  FeatureFlagDelegationConstraintSkipConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const DelegationDocumentConfig = z
  .object({
    DELEGATION_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    delegationDocumentsPath: c.DELEGATION_DOCUMENTS_PATH,
  }));

const DelegationProcessConfig = CommonHTTPServiceConfig.and(
  ReadModelSQLDbConfig
)
  .and(EventStoreConfig)
  .and(S3Config)
  .and(FileManagerConfig)
  .and(DelegationDocumentConfig)
  .and(FeatureFlagDelegationsProcessContractBuilderConfig)
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

export type DelegationProcessConfig = z.infer<typeof DelegationProcessConfig>;
export const config: DelegationProcessConfig = DelegationProcessConfig.parse(
  process.env
);
