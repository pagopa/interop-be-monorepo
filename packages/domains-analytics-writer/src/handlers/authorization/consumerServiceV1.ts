/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import {
  AuthorizationEventEnvelopeV1,
  dateToString,
  fromClientV1,
  fromKeyV1,
  genericInternalError,
  Key,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { createJWK } from "pagopa-interop-commons";
import { splitClientIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import { authorizationServiceBuilder } from "../../service/authorizationService.js";
import {
  ClientKeyDeletingSchema,
  ClientKeySchema,
  ClientKeyUserMigrationSchema,
} from "../../model/authorization/clientKey.js";
import {
  ClientItemsSchema,
  ClientDeletingSchema,
} from "../../model/authorization/client.js";
import {
  ClientPurposeDeletingSchema,
  ClientPurposeSchema,
} from "../../model/authorization/clientPurpose.js";
import {
  ClientUserDeletingSchema,
  ClientUserSchema,
} from "../../model/authorization/clientUser.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleAuthorizationMessageV1(
  messages: AuthorizationEventEnvelopeV1[],
  dbContext: DBContext
): Promise<void> {
  const authorizationService = authorizationServiceBuilder(dbContext);

  const upsertClientBatch: ClientItemsSchema[] = [];
  const deleteClientBatch: ClientDeletingSchema[] = [];
  const upsertClientUserBatch: ClientUserSchema[] = [];
  const removeClientUserBatch: ClientUserDeletingSchema[] = [];
  const upsertClientPurposeBatch: ClientPurposeSchema[] = [];
  const removeClientPurposeBatch: ClientPurposeDeletingSchema[] = [];
  const upsertClientKeyBatch: ClientKeySchema[] = [];
  const deleteClientKeyBatch: ClientKeyDeletingSchema[] = [];
  const migrateKeyUserRelationshipBatch: ClientKeyUserMigrationSchema[] = [];

  for (const message of messages) {
    await match(message)
      .with({ type: "ClientAdded" }, async (msg) => {
        const client = msg.data.client;
        if (!client) {
          throw genericInternalError(
            "Client can't be missing in event message"
          );
        }

        const splitResult = splitClientIntoObjectsSQL(
          fromClientV1(client),
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
      })
      .with({ type: "ClientDeleted" }, async (msg) => {
        deleteClientBatch.push(
          ClientDeletingSchema.parse({
            id: msg.data.clientId,
            deleted: true,
          } satisfies z.input<typeof ClientDeletingSchema>)
        );
      })
      .with({ type: "UserAdded" }, async (msg) => {
        const client = msg.data.client;
        if (!client) {
          throw genericInternalError(
            "Client can't be missing in event message"
          );
        }

        upsertClientUserBatch.push(
          ClientUserSchema.parse({
            clientId: client.id,
            userId: msg.data.userId,
            metadataVersion: msg.version,
          } satisfies z.input<typeof ClientUserSchema>)
        );
      })
      .with({ type: "UserRemoved" }, async (msg) => {
        const client = msg.data.client;
        if (!client) {
          throw genericInternalError(
            "Client can't be missing in event message"
          );
        }

        removeClientUserBatch.push(
          ClientUserDeletingSchema.parse({
            clientId: client.id,
            userId: msg.data.userId,
          } satisfies z.input<typeof ClientUserDeletingSchema>)
        );
      })
      .with({ type: "ClientPurposeAdded" }, async (msg) => {
        const purposeId = msg.data.statesChain?.purpose?.purposeId;
        if (!purposeId) {
          throw genericInternalError(
            "purposeId can't be missing in event message"
          );
        }

        upsertClientPurposeBatch.push(
          ClientPurposeSchema.parse({
            clientId: msg.data.clientId,
            purposeId,
            metadataVersion: msg.version,
          } satisfies z.input<typeof ClientPurposeSchema>)
        );
      })
      .with({ type: "ClientPurposeRemoved" }, async (msg) => {
        removeClientPurposeBatch.push(
          ClientPurposeDeletingSchema.parse({
            clientId: msg.data.clientId,
            purposeId: msg.data.purposeId,
          } satisfies z.input<typeof ClientPurposeDeletingSchema>)
        );
      })
      .with({ type: "KeysAdded" }, async (msg) => {
        const keysSQL = msg.data.keys
          .map((keyV1) => (keyV1.value ? fromKeyV1(keyV1.value) : undefined))
          .filter((k): k is Key => !!k)
          .filter((k) => {
            const jwk = createJWK({
              pemKeyBase64: k.encodedPem,
              strictCheck: false,
            });
            return jwk.kty !== "EC";
          })
          .map((key) =>
            ClientKeySchema.parse({
              ...key,
              metadataVersion: msg.version,
              clientId: msg.data.clientId,
              userId: key.userId !== "" ? key.userId : null,
              createdAt: dateToString(key.createdAt),
            } satisfies z.input<typeof ClientKeySchema>)
          );

        upsertClientKeyBatch.push(...keysSQL);
      })
      .with({ type: "KeyDeleted" }, async (msg) => {
        deleteClientKeyBatch.push(
          ClientKeyDeletingSchema.parse({
            clientId: msg.data.clientId,
            kid: msg.data.keyId,
            deleted: true,
            deleted_at: dateToString(msg.log_date),
          } satisfies z.input<typeof ClientKeyDeletingSchema>)
        );
      })
      .with({ type: "KeyRelationshipToUserMigrated" }, async (msg) => {
        migrateKeyUserRelationshipBatch.push(
          ClientKeyUserMigrationSchema.parse({
            clientId: msg.data.clientId,
            kid: msg.data.keyId,
            userId: msg.data.userId,
            metadataVersion: msg.version,
          } satisfies z.input<typeof ClientKeyUserMigrationSchema>)
        );
      })
      .with(
        { type: "RelationshipAdded" },
        { type: "RelationshipRemoved" },
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

  if (upsertClientUserBatch.length > 0) {
    await authorizationService.upsertClientUserBatch(
      dbContext,
      upsertClientUserBatch
    );
  }

  if (removeClientUserBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      removeClientUserBatch,
      ClientUserDeletingSchema,
      ["clientId", "userId"]
    );
    await authorizationService.removeClientUserBatch(dbContext, distinctBatch);
  }

  if (upsertClientPurposeBatch.length > 0) {
    await authorizationService.upsertClientPurposeBatch(
      dbContext,
      upsertClientPurposeBatch
    );
  }

  if (removeClientPurposeBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      removeClientPurposeBatch,
      ClientPurposeDeletingSchema,
      ["clientId", "purposeId"]
    );
    await authorizationService.removeClientPurposeBatch(
      dbContext,
      distinctBatch
    );
  }

  if (deleteClientKeyBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteClientKeyBatch,
      ClientKeyDeletingSchema,
      ["clientId", "kid"]
    );
    await authorizationService.deleteClientKeyBatch(dbContext, distinctBatch);
  }

  if (upsertClientKeyBatch.length > 0) {
    await authorizationService.upsertClientKeyBatch(
      dbContext,
      upsertClientKeyBatch
    );
  }

  if (migrateKeyUserRelationshipBatch.length > 0) {
    await authorizationService.upsertMigrateKeyUserRelationshipBatch(
      dbContext,
      migrateKeyUserRelationshipBatch
    );
  }
}
