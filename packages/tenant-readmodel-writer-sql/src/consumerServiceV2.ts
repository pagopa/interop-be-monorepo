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
          "TenantOnboarded",
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
        if (!message.data.tenant) {
          throw missingKafkaMessageDataError("tenant", message.type);
        }

        await tenantWriterService.upsertTenant(
          fromTenantV2(message.data.tenant),
          message.version
        );
      }
    )
    .exhaustive();
}
