import { Logger } from "pagopa-interop-commons";
import {
  TenantEventEnvelopeV1,
  TenantEventEnvelopeV2,
  fromTenantV1,
  fromTenantV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { TenantKindHistoryWriterService } from "./tenantKindHistoryWriterService.js";

export async function handleMessageV1(
  message: TenantEventEnvelopeV1,
  tenantKindHistoryWriterService: TenantKindHistoryWriterService,
  logger: Logger
): Promise<void> {
  await match(message)
    .with(
      { type: P.union("TenantCreated", "TenantUpdated") },
      async (message) => {
        if (!message.data.tenant) {
          throw missingKafkaMessageDataError("tenant", "TenantOnboarded");
        }
        const tenant = fromTenantV1(message.data.tenant);
        await tenantKindHistoryWriterService.createTenantKindHistoryEntry(
          tenant.id,
          message.version,
          tenant.kind,
          message.log_date
        );
      }
    )
    .with(
      {
        type: P.union(
          "TenantDeleted",
          "SelfcareMappingCreated",
          "SelfcareMappingDeleted",
          "TenantMailAdded",
          "TenantMailDeleted"
        ),
      },
      async (message) => {
        logger.info(`Ignoring ${message.type} message`);
      }
    )
    .exhaustive();
}

export async function handleMessageV2(
  message: TenantEventEnvelopeV2,
  tenantKindHistoryWriterService: TenantKindHistoryWriterService,
  logger: Logger
): Promise<void> {
  await match(message)
    .with(
      {
        type: P.union(
          "TenantOnboarded",
          "TenantOnboardDetailsUpdated",
          "MaintenanceTenantUpdated",
          "TenantKindUpdated"
        ),
      },
      async (message) => {
        if (!message.data.tenant) {
          throw missingKafkaMessageDataError("tenant", message.type);
        }
        const tenant = fromTenantV2(message.data.tenant);
        await tenantKindHistoryWriterService.createTenantKindHistoryEntry(
          tenant.id,
          message.version,
          tenant.kind,
          message.log_date
        );
      }
    )
    .with(
      {
        type: P.union(
          "MaintenanceTenantDeleted",
          "TenantCertifiedAttributeAssigned",
          "TenantCertifiedAttributeRevoked",
          "TenantDeclaredAttributeAssigned",
          "TenantDeclaredAttributeRevoked",
          "TenantVerifiedAttributeAssigned",
          "TenantVerifiedAttributeRevoked",
          "TenantVerifiedAttributeExpirationUpdated",
          "TenantVerifiedAttributeExtensionUpdated",
          "TenantMailAdded",
          "MaintenanceTenantPromotedToCertifier",
          "TenantMailDeleted",
          "TenantDelegatedProducerFeatureAdded",
          "TenantDelegatedProducerFeatureRemoved",
          "TenantDelegatedConsumerFeatureAdded",
          "TenantDelegatedConsumerFeatureRemoved"
        ),
      },
      async (message) => {
        logger.info(`Ignoring ${message.type} message`);
      }
    )
    .exhaustive();
}
