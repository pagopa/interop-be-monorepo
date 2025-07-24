import { isAxiosError } from "axios";
import {
  Logger,
  RefreshableInteropToken,
  getInteropHeaders,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  TenantEventEnvelopeV2,
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
  return {
    async processMessage(
      message: TenantEventEnvelopeV2,
      correlationId: CorrelationId,
      logger: Logger
    ): Promise<void> {
      await match(message)
        .with({ type: "TenantOnboarded" }, async (message) => {
          if (!message.data.tenant) {
            throw missingKafkaMessageDataError("tenant", "TenantOnboarded");
          }
          const token = (await refreshableToken.get()).serialized;
          const headers = getInteropHeaders({ token, correlationId });
          logger.info(
            `Creating default notification config for tenant ${message.data.tenant.id}`
          );
          try {
            await notificationConfigProcess.client.createTenantDefaultNotificationConfig(
              { tenantId: fromTenantV2(message.data.tenant).id },
              {
                headers,
              }
            );
          } catch (error) {
            if (isAxiosError(error) && error.response?.status === 409) {
              logger.info(
                `Notification config for tenant ${message.data.tenant.id} already exists, skipping creation`
              );
            } else {
              throw genericInternalError(
                `Error creating default notification config for tenant ${message.data.tenant.id}. Reason: ${error}`
              );
            }
          }
        })
        .with({ type: "MaintenanceTenantDeleted" }, async (message) => {
          const token = (await refreshableToken.get()).serialized;
          const headers = getInteropHeaders({ token, correlationId });
          logger.info(
            `Deleting notification config for tenant ${message.data.tenantId}`
          );
          try {
            await notificationConfigProcess.client.deleteTenantNotificationConfig(
              undefined,
              {
                params: { tenantId: unsafeBrandId(message.data.tenantId) },
                headers,
              }
            );
          } catch (error) {
            if (isAxiosError(error) && error.response?.status === 404) {
              logger.info(
                `Notification config for tenant ${message.data.tenantId} not found, skipping deletion`
              );
            } else {
              throw genericInternalError(
                `Error deleting default notification config for tenant ${message.data.tenantId}. Reason: ${error}`
              );
            }
          }
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
