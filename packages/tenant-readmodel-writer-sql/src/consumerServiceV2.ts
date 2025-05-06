import {
  TenantEventEnvelopeV2,
  fromTenantV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { ReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: TenantEventEnvelopeV2,
  readModelService: ReadModelService
): Promise<void> {
  await match(message)
    .with({ type: "MaintenanceTenantDeleted" }, async (message) => {
      await readModelService.deleteTenant(
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
          throw genericInternalError("Tenant not found in message");
        }

        await readModelService.upsertTenant(
          fromTenantV2(message.data.tenant),
          message.version
        );
      }
    )
    .exhaustive();
}
