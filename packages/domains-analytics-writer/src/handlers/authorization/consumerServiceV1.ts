import { AuthorizationEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export function handleAuthorizationMessageV1(
  event: AuthorizationEventEnvelopeV1
): Promise<void> {
  return match(event)
    .with(
      P.union(
        { type: "KeysAdded" },
        { type: "KeyDeleted" },
        { type: "KeyRelationshipToUserMigrated" },
        { type: "ClientAdded" },
        { type: "ClientDeleted" },
        { type: "RelationshipAdded" },
        { type: "RelationshipRemoved" },
        { type: "UserAdded" },
        { type: "UserRemoved" },
        { type: "ClientPurposeAdded" },
        { type: "ClientPurposeRemoved" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
