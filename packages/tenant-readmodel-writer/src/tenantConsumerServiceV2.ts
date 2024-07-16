import { TenantCollection } from "pagopa-interop-commons";
import { TenantEventEnvelopeV2, fromTenantV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: TenantEventEnvelopeV2,
  tenants: TenantCollection
): Promise<void> {
  const tenant = message.data.tenant;

  await match(message)
    .with({ type: "MaintenanceTenantDeleted" }, async (message) => {
      await tenants.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lte: message.version },
      });
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
      { type: "TenantKindUpdated" },
      async (message) =>
        await tenants.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lte: message.version },
          },
          {
            $set: {
              data: tenant ? fromTenantV2(tenant) : undefined,
              metadata: {
                version: message.version,
              },
            },
          },
          { upsert: true }
        )
    )
    .exhaustive();
}
