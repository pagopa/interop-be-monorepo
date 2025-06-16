/* eslint-disable functional/immutable-data */
import {
  AuthorizationEventEnvelopeV2,
  fromClientV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitClientIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import { authorizationServiceBuilder } from "../../service/authorizationService.js";
import {
  ClientItemsSchema,
  ClientDeletingSchema,
} from "../../model/authorization/client.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleAuthorizationEventMessageV2(
  messages: AuthorizationEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const authorizationService = authorizationServiceBuilder(dbContext);

  const upsertClientBatch: ClientItemsSchema[] = [];
  const deleteClientBatch: ClientDeletingSchema[] = [];

  for (const message of messages) {
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
        async (msg) => {
          const clientV2 = msg.data.client;

          if (!clientV2) {
            throw genericInternalError(
              "Client can't be missing in event message"
            );
          }

          const splitResult = splitClientIntoObjectsSQL(
            fromClientV2(clientV2),
            msg.version
          );

          upsertClientBatch.push(
            ClientItemsSchema.parse({
              clientSQL: splitResult.clientSQL,
              usersSQL: splitResult.usersSQL,
              purposesSQL: splitResult.purposesSQL,
              keysSQL: splitResult.keysSQL,
            } satisfies z.input<typeof ClientItemsSchema>)
          );
        }
      )
      .with({ type: "ClientDeleted" }, async (msg) => {
        deleteClientBatch.push(
          ClientDeletingSchema.parse({
            id: msg.data.clientId,
            deleted: true,
          } satisfies z.input<typeof ClientDeletingSchema>)
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
        () => Promise.resolve()
      )
      .exhaustive();
  }

  if (upsertClientBatch.length > 0) {
    await authorizationService.upsertClientBatch(dbContext, upsertClientBatch);
  }

  if (deleteClientBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteClientBatch,
      ClientDeletingSchema,
      ["id"]
    );
    await authorizationService.deleteClientBatch(dbContext, distinctBatch);
  }
}
