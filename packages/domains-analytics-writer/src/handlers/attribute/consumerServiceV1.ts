import { AttributeEventEnvelope } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleAttributeMessageV1(
  messages: AttributeEventEnvelope[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
    await match(message)
      .with(
        { type: P.union("AttributeAdded", "MaintenanceAttributeDeleted") },
        async () => Promise.resolve()
      )
      .exhaustive();
  }
}
