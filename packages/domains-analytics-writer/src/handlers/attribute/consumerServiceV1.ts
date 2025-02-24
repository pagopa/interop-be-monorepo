import { AttributeEventEnvelope } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleAttributeMessageV1(
  message: AttributeEventEnvelope
): Promise<void> {
  await match(message)
    .with({ type: "AttributeAdded" }, async () => Promise.resolve())
    .with({ type: "MaintenanceAttributeDeleted" }, async () =>
      Promise.resolve()
    )
    .exhaustive();
}
