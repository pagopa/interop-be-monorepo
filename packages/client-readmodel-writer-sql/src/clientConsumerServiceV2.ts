import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { ReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  readModelService: ReadModelService
): Promise<void> {
  await match(message)
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientKeyAdded",
          "ClientKeyDeleted",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientAdminRemoved",
          "ClientPurposeAdded",
          "ClientPurposeRemoved"
        ),
      },
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
        unsafeBrandId(message.data.clientId),
        message.version
      );
    })
    .with(
      {
        type: P.union(
          "ProducerKeychainAdded",
          "ProducerKeychainDeleted",
          "ProducerKeychainKeyAdded",
          "ProducerKeychainKeyDeleted",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted",
          "ProducerKeychainEServiceAdded",
          "ProducerKeychainEServiceRemoved"
        ),
      },
      () => Promise.resolve
    )
    .exhaustive();
}
