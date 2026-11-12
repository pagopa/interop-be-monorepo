import {
  TenantEventEnvelopeV3,
  fromTenantV3,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";

import { TenantWriterService } from "./tenantWriterService.js";

export async function handleMessageV3(
  message: TenantEventEnvelopeV3,
  tenantWriterService: TenantWriterService
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
          "TenantContactAdded",
          "TenantContactDeleted",
          "TenantDeclaredAttributeAssigned",
          "TenantDeclaredAttributeRevoked",
          "TenantDelegatedConsumerFeatureAdded",
          "TenantDelegatedConsumerFeatureRemoved",
          "TenantDelegatedProducerFeatureAdded",
          "TenantDelegatedProducerFeatureRemoved",
          "TenantKindUpdated",
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

        await tenantWriterService.upsertTenant(
          fromTenantV3(message.data.tenant),
          message.version
        );
      }
    )
    .exhaustive();
}
