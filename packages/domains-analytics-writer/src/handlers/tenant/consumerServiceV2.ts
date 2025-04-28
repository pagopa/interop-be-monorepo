import { TenantEventV2 } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleTenantMessageV2(
  messages: TenantEventV2[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
    await match(message)
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
}
