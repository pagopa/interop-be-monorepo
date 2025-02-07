import { TenantEventEnvelopeV1 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleTenantMessageV1(
  decodedMessage: TenantEventEnvelopeV1
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "TenantCreated" }, async () => Promise.resolve())
    .with({ type: "TenantDeleted" }, async () => Promise.resolve())
    .with({ type: "TenantUpdated" }, async () => Promise.resolve())
    .with({ type: "SelfcareMappingCreated" }, async () => Promise.resolve())
    .with({ type: "SelfcareMappingDeleted" }, async () => Promise.resolve())
    .with({ type: "TenantMailAdded" }, async () => Promise.resolve())
    .with({ type: "TenantMailDeleted" }, async () => Promise.resolve())
    .exhaustive();
}
