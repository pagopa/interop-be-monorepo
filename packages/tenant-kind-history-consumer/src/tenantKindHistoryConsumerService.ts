import { isAxiosError } from "axios";
import {
  Logger,
} from "pagopa-interop-commons";
import {
  TenantEventEnvelopeV1,
  TenantEventEnvelopeV2,
  TenantId,
  fromTenantV1,
  fromTenantV2,
  genericInternalError,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { TenantKindHistoryWriterService } from "./tenantKindHistoryWriterService.js";

/* TODO:
V1

    TenantCreated

    TenantUpdated

V2

    TenantOnboarded

    TenantOnboardDetailsUpdated

    MaintenanceTenantUpdated

    TenantKindUpdated
*/

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantKindhistoryConsumerServiceBuilder(
  tenantKindHistoryWriterService: TenantKindHistoryWriterService
) {
  const createTenantKindHistory = async (
    tenantId: TenantId,
    logger: Logger
  ): Promise<void> => {
    logger.info(`Creating default notification config for tenant ${tenantId}`);
    try {
      await tenantKindHistoryWriterService.createTenantKindHistory(/*TODO*/);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        logger.info(
          `Notification config for tenant ${tenantId} already exists, skipping creation`
        );
      } else {
        throw genericInternalError(
          `Error creating default notification config for tenant ${tenantId}. Reason: ${error}`
        );
      }
    }
  };

  return {
    async handleMessageV1(
      message: TenantEventEnvelopeV1,
      logger: Logger
    ): Promise<void> {
      await match(message)
        .with({ type: "TenantCreated" }, async (message) => {
          if (!message.data.tenant) {
            throw missingKafkaMessageDataError("tenant", "TenantOnboarded");
          }
          await createTenantKindHistory(
            fromTenantV1(message.data.tenant).id,
            logger
          );
        })
        .with(
          {
            type: P.union(
              "TenantDeleted",
              "TenantUpdated",
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
        .with({ type: "TenantOnboarded" }, async (message) => {
          if (!message.data.tenant) {
            throw missingKafkaMessageDataError("tenant", "TenantOnboarded");
          }
          await createTenantKindHistory(
            fromTenantV2(message.data.tenant).id,
            logger
          );
        })
        .with(
          {
            type: P.union(
              "MaintenanceTenantDeleted",
              "TenantOnboardDetailsUpdated",
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
              "MaintenanceTenantUpdated",
              "TenantMailDeleted",
              "TenantKindUpdated",
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
