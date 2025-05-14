import { TenantEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleTenantMessageV1(
  messages: TenantEventEnvelopeV1[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
    await match(message)
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
}
