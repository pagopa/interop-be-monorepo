import { KeyCollection } from "pagopa-interop-commons";
import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  _keys: KeyCollection
): Promise<void> {
  match(message)
    .with({ type: "ClientKeyAdded" }, () => Promise.resolve)
    .with({ type: "ClientKeyDeleted" }, () => Promise.resolve)
    .with(
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
