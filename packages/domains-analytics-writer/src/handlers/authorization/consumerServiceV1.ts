import { AuthorizationEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleAuthorizationMessageV1(
  messages: AuthorizationEventEnvelopeV1[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
    await match(message)
      .with(
        {
          type: P.union(
            "KeysAdded",
            "KeyDeleted",
            "KeyRelationshipToUserMigrated",
            "ClientAdded",
            "ClientDeleted",
            "RelationshipAdded",
            "RelationshipRemoved",
            "UserAdded",
            "UserRemoved",
            "ClientPurposeAdded",
            "ClientPurposeRemoved"
          ),
        },
        async () => Promise.resolve()
      )
      .exhaustive();
  }
}
