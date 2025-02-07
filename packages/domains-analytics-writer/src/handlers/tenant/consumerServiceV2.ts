import { TenantEventV2 } from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export async function handleTenantMessageV2(
  decodedMessage: TenantEventV2
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "MaintenanceTenantDeleted" }, async () => Promise.resolve())
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
      async () => Promise.resolve()
    )
    .exhaustive();
}
