import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  Logger,
  RefreshableInteropToken,
  getInteropHeaders,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  TenantEventEnvelopeV1,
  TenantEventEnvelopeV2,
  TenantId,
  fromTenantV1,
  fromTenantV2,
  genericInternalError,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { PagoPAInteropBeClients } from "./clients/clientsProvider.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function notificationTenantLifecycleConsumerServiceBuilder(
  refreshableToken: RefreshableInteropToken,
  { notificationConfigProcess }: PagoPAInteropBeClients
) {
  const createTenantDefaultNotificationConfig = async (
    tenantId: TenantId,
    correlationId: CorrelationId,
    logger: Logger
  ): Promise<void> => {
    const token = (await refreshableToken.get()).serialized;
    const headers = getInteropHeaders({ token, correlationId });
    logger.info(`Creating default notification config for tenant ${tenantId}`);

    const { error } =
      await notificationConfigApi.createTenantDefaultNotificationConfig({
        body: { tenantId },
        headers,
        client: notificationConfigProcess.client,
      });

    if (error) {
      if (error.status === 409) {
        logger.info(
          `Notification config for tenant ${tenantId} already exists, skipping creation`
        );
      } else {
        throw genericInternalError(
          `Error creating default notification config for tenant ${tenantId}. Reason: ${error.status} - ${error.title}`
        );
      }
    }
  };

  const deleteTenantNotificationConfig = async (
    tenantId: TenantId,
    correlationId: CorrelationId,
    logger: Logger
  ): Promise<void> => {
    const token = (await refreshableToken.get()).serialized;
    const headers = getInteropHeaders({ token, correlationId });
    logger.info(`Deleting notification config for tenant ${tenantId}`);

    const { error } =
      await notificationConfigApi.deleteTenantNotificationConfig({
        path: { tenantId },
        headers,
        client: notificationConfigProcess.client,
      });

    if (error) {
      throw genericInternalError(
        `Error deleting default notification config for tenant ${tenantId}. Reason: ${error.status} - ${error.title}`
      );
    }
  };

  return {
    async handleMessageV1(
      message: TenantEventEnvelopeV1,
      correlationId: CorrelationId,
      logger: Logger
    ): Promise<void> {
      await match(message)
        .with({ type: "TenantCreated" }, async (message) => {
          if (!message.data.tenant) {
            throw missingKafkaMessageDataError("tenant", "TenantOnboarded");
          }
          await createTenantDefaultNotificationConfig(
            fromTenantV1(message.data.tenant).id,
            correlationId,
            logger
          );
        })
        .with({ type: "TenantDeleted" }, async (message) => {
          await deleteTenantNotificationConfig(
            unsafeBrandId(message.data.tenantId),
            correlationId,
            logger
          );
        })
        .with(
          {
            type: P.union(
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
      correlationId: CorrelationId,
      logger: Logger
    ): Promise<void> {
      await match(message)
        .with({ type: "TenantOnboarded" }, async (message) => {
          if (!message.data.tenant) {
            throw missingKafkaMessageDataError("tenant", "TenantOnboarded");
          }
          await createTenantDefaultNotificationConfig(
            fromTenantV2(message.data.tenant).id,
            correlationId,
            logger
          );
        })
        // eslint-disable-next-line sonarjs/no-identical-functions
        .with({ type: "MaintenanceTenantDeleted" }, async (message) => {
          await deleteTenantNotificationConfig(
            unsafeBrandId(message.data.tenantId),
            correlationId,
            logger
          );
        })
        .with(
          {
            type: P.union(
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
