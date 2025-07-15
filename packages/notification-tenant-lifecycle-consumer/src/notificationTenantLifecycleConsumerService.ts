import {
  Logger,
  RefreshableInteropToken,
  getInteropHeaders,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  TenantEventEnvelopeV2,
  fromTenantV2,
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
          await notificationConfigProcess.client.createTenantDefaultNotificationConfig(
            { tenantId: fromTenantV2(message.data.tenant).id },
            {
              headers,
            }
          );
        })
        .with({ type: "MaintenanceTenantDeleted" }, async (message) => {
          const token = (await refreshableToken.get()).serialized;
          const headers = getInteropHeaders({ token, correlationId });
          logger.info(
            `Deleting notification config for tenant ${message.data.tenantId}`
          );
          await notificationConfigProcess.client.deleteTenantNotificationConfig(
            undefined,
            {
              params: { tenantId: unsafeBrandId(message.data.tenantId) },
              headers,
            }
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
