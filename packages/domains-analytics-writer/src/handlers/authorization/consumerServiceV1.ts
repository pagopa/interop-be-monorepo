import { AuthorizationEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export function handleAuthorizationMessageV1(
  event: AuthorizationEventEnvelopeV1
): Promise<void> {
  return match(event)
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
