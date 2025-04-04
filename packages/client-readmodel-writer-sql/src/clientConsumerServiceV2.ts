import {
  AuthorizationEventEnvelopeV2,
  ClientId,
  fromClientV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  readModelService: ReadModelService
): Promise<void> {
  await match(message)
    .with(
      { type: "ClientAdded" },
      { type: "ClientKeyAdded" },
      { type: "ClientKeyDeleted" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      async (message) => {
        const clientV2 = message.data.client;

        if (!clientV2) {
          throw genericInternalError(
            "client can't be missing in event message"
          );
        }

        await readModelService.upsertClient(
          fromClientV2(clientV2),
          message.version
        );
      }
    )
    .with({ type: "ClientDeleted" }, async (message) => {
      await readModelService.deleteClientById(
        unsafeBrandId<ClientId>(message.data.clientId),
        message.version
      );
    })
    .with(
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainDeleted" },
      { type: "ProducerKeychainKeyAdded" },
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      () => Promise.resolve
    )
    .exhaustive();
}
