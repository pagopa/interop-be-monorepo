import {
  TenantEventEnvelopeV2,
  fromTenantV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { TenantReadModelServiceSQL } from "pagopa-interop-readmodel";

export async function handleMessageV2(
  message: TenantEventEnvelopeV2,
  tenantReadModelService: TenantReadModelServiceSQL
): Promise<void> {
  await match(message)
    .with({ type: "MaintenanceTenantDeleted" }, async (message) => {
      await tenantReadModelService.deleteTenantById(
        unsafeBrandId(message.data.tenantId),
        message.version
      );
    })
    .with(
      { type: "TenantOnboarded" },
      { type: "TenantOnboardDetailsUpdated" },
      { type: "TenantCertifiedAttributeAssigned" },
      { type: "TenantCertifiedAttributeRevoked" },
      { type: "TenantDeclaredAttributeAssigned" },
      { type: "TenantDeclaredAttributeRevoked" },
      { type: "TenantVerifiedAttributeAssigned" },
      { type: "TenantVerifiedAttributeRevoked" },
      { type: "TenantVerifiedAttributeExpirationUpdated" },
      { type: "TenantVerifiedAttributeExtensionUpdated" },
      { type: "TenantMailAdded" },
      { type: "MaintenanceTenantPromotedToCertifier" },
      { type: "MaintenanceTenantUpdated" },
      { type: "TenantMailDeleted" },
      { type: "TenantKindUpdated" },
      { type: "TenantDelegatedProducerFeatureAdded" },
      { type: "TenantDelegatedProducerFeatureRemoved" },
      { type: "TenantDelegatedConsumerFeatureAdded" },
      { type: "TenantDelegatedConsumerFeatureRemoved" },
      async (message) => {
        if (!message.data.tenant) {
          throw genericInternalError("Tenant not found in message");
        }

        await tenantReadModelService.upsertTenant({
          data: fromTenantV2(message.data.tenant),
          metadata: { version: message.version },
        });
      }
    )
    .exhaustive();
}
