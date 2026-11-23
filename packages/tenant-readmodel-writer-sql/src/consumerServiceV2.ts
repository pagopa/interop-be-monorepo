import { genericLogger, Logger } from "pagopa-interop-commons";
import {
  TenantEventEnvelopeV2,
  fromTenantV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";

import { TenantWriterService } from "./tenantWriterService.js";

export async function handleMessageV2(
  message: TenantEventEnvelopeV2,
  tenantWriterService: TenantWriterService,
  logger: Logger = genericLogger
): Promise<void> {
  await match(message)
    .with({ type: "MaintenanceTenantDeleted" }, async (message) => {
      await tenantWriterService.deleteTenantById(
        unsafeBrandId(message.data.tenantId),
        message.version
      );
    })
    .with(
      {
        type: P.union(
          "MaintenanceTenantPromotedToCertifier",
          "MaintenanceTenantUpdated",
          "TenantCertifiedAttributeAssigned",
          "TenantCertifiedAttributeRevoked",
          "TenantCertifiedDiscreteAttributeAssigned",
          "TenantCertifiedDiscreteAttributeRevoked",
          "TenantCertifiedDiscreteAttributeUpdated",
          "TenantDeclaredAttributeAssigned",
          "TenantDeclaredAttributeRevoked",
          "TenantDelegatedConsumerFeatureAdded",
          "TenantDelegatedConsumerFeatureRemoved",
          "TenantDelegatedProducerFeatureAdded",
          "TenantDelegatedProducerFeatureRemoved",
          "TenantKindUpdated",
          "TenantMailAdded",
          "TenantMailDeleted",
          "TenantOnboardDetailsUpdated",
          "TenantOnboarded",
          "TenantRemoteIdAssigned",
          "MaintenanceTenantRemoteIdDeleted",
          "TenantVerifiedAttributeAssigned",
          "TenantVerifiedAttributeExpirationUpdated",
          "TenantVerifiedAttributeExtensionUpdated",
          "TenantVerifiedAttributeRevoked"
        ),
      },
      async (message) => {
        if (!message.data.tenant) {
          throw missingKafkaMessageDataError("tenant", message.type);
        }

        const tenant = fromTenantV2(message.data.tenant);
        const replacedContactId = await tenantWriterService.upsertTenant(
          tenant,
          message.version
        );
        // V2 events carry no contact reference: after a V3 event they drop it.
        if (replacedContactId !== undefined) {
          logger.warn(
            `Tenant ${tenant.id} lost its contact reference ${replacedContactId}: V2 event ${message.type} carries no contact`
          );
        }
      }
    )
    .exhaustive();
}
