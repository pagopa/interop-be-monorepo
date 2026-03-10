import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { ClientWriterService } from "./clientWriterService.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  clientWriterService: ClientWriterService
): Promise<void> {
  await match(message)
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientKeyAdded",
          "ClientAdminSet",
          "ClientKeyDeleted",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientAdminRoleRevoked",
          "ClientAdminRemoved",
          "ClientPurposeAdded",
          "ClientPurposeRemoved"
        ),
      },
      async (message) => {
        const clientV2 = message.data.client;

        if (!clientV2) {
          throw missingKafkaMessageDataError("client", message.type);
        }

        await clientWriterService.upsertClient(
          fromClientV2(clientV2),
          message.version
        );
      }
    )
    .with({ type: "ClientDeleted" }, async (message) => {
      await clientWriterService.deleteClientById(
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
