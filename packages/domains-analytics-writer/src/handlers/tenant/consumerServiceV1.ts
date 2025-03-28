import { TenantEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleTenantMessageV1(
  decodedMessage: TenantEventEnvelopeV1
): Promise<void> {
  await match(decodedMessage)
    .with(
      P.union(
        { type: "TenantCreated" },
        { type: "TenantDeleted" },
        { type: "TenantUpdated" },
        { type: "SelfcareMappingCreated" },
        { type: "SelfcareMappingDeleted" },
        { type: "TenantMailAdded" },
        { type: "TenantMailDeleted" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
