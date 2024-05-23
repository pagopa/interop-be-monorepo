import { KeyCollection } from "pagopa-interop-commons";
import { AuthorizationEventEnvelopeV1 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  _keys: KeyCollection
): Promise<void> {
  match(message)
    .with(
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
      { type: "ClientPurposeRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
