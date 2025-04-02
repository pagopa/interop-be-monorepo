import { TenantEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleTenantMessageV1(
  decodedMessage: TenantEventEnvelopeV1
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "TenantCreated",
          "TenantDeleted",
          "TenantUpdated",
          "SelfcareMappingCreated",
          "SelfcareMappingDeleted",
          "TenantMailAdded",
          "TenantMailDeleted"
        ),
      },
      async () => Promise.resolve()
    )
    .exhaustive();
}
