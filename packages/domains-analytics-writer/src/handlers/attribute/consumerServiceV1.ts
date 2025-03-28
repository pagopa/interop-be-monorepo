import { AttributeEventEnvelope } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleAttributeMessageV1(
  message: AttributeEventEnvelope
): Promise<void> {
  await match(message)
    .with(
      { type: P.union("AttributeAdded", "MaintenanceAttributeDeleted") },
      async () => Promise.resolve()
    )
    .exhaustive();
}
