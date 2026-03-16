import { Logger } from "pagopa-interop-commons";
import {
  Tenant,
  TenantEventEnvelopeV1,
  TenantEventEnvelopeV2,
  fromTenantV1,
  fromTenantV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { TenantKindHistoryWriterService } from "./tenantKindHistoryWriterService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantKindhistoryConsumerServiceBuilder(
  tenantKindHistoryWriterService: TenantKindHistoryWriterService
) {
  const createTenantKindHistory = async (
    tenant: Tenant,
    metadataVersion: number,
    messageTimestamp: Date
  ): Promise<void> => {
    await tenantKindHistoryWriterService.createTenantKindHistory(
      tenant.id,
      metadataVersion,
      tenant.kind,
      messageTimestamp
    );
  };

  return {
    async handleMessageV1(
      message: TenantEventEnvelopeV1,
      logger: Logger
    ): Promise<void> {
      await match(message)
        .with(
          { type: P.union("TenantCreated", "TenantUpdated") },
          async (message) => {
            if (!message.data.tenant) {
              throw missingKafkaMessageDataError("tenant", "TenantOnboarded");
            }
            await createTenantKindHistory(
              fromTenantV1(message.data.tenant),
              message.version,
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
    },

    async handleMessageV2(
      message: TenantEventEnvelopeV2,
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
            await createTenantKindHistory(
              fromTenantV2(message.data.tenant),
              message.version,
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
    },
  };
}
