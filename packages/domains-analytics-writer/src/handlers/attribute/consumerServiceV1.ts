import { AttributeEventEnvelope } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleAttributeMessageV1(
  message: AttributeEventEnvelope
): Promise<void> {
  await match(message)
    .with(
      P.union(
        { type: "AttributeAdded" },
        { type: "MaintenanceAttributeDeleted" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
