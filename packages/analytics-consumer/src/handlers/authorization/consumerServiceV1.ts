import { AuthorizationEventEnvelopeV1 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export function handleAuthorizationMessageV1(
  event: AuthorizationEventEnvelopeV1
): Promise<void> {
  return match(event)
    .with({ type: "KeysAdded" }, async () => Promise.resolve())
    .with({ type: "KeyDeleted" }, async () => Promise.resolve())
    .with({ type: "KeyRelationshipToUserMigrated" }, async () =>
      Promise.resolve()
    )
    .with({ type: "ClientAdded" }, async () => Promise.resolve())
    .with({ type: "ClientDeleted" }, async () => Promise.resolve())
    .with({ type: "RelationshipAdded" }, async () => Promise.resolve())
    .with({ type: "RelationshipRemoved" }, async () => Promise.resolve())
    .with({ type: "UserAdded" }, async () => Promise.resolve())
    .with({ type: "UserRemoved" }, async () => Promise.resolve())
    .with({ type: "ClientPurposeAdded" }, async () => Promise.resolve())
    .with({ type: "ClientPurposeRemoved" }, async () => Promise.resolve())
    .exhaustive();
}
