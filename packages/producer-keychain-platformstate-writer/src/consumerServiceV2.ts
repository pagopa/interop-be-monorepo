import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV2,
  EServiceId,
  fromProducerKeychainV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  deleteAllProducerKeychainPlatformStatesEntries,
  deleteProducerKeychainPlatformStatesEntriesByEServiceId,
  deleteProducerKeychainPlatformStatesEntriesByKid,
  upsertProducerKeychainPlatformStatesEntriesByKid,
  upsertProducerKeychainPlatformStatesEntriesByEServiceId,
} from "./utils.js";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient,
  tableName: string,
  logger: Logger
): Promise<void> {
  await match(message)
    .with({ type: "ProducerKeychainKeyAdded" }, async (msg) => {
      const producerKeychain = msg.data.producerKeychain;
      if (!producerKeychain) {
        throw missingKafkaMessageDataError("producerKeychain", msg.type);
      }

      const parsedProducerKeychain = fromProducerKeychainV2(producerKeychain);

      await upsertProducerKeychainPlatformStatesEntriesByKid({
        producerKeychainId: parsedProducerKeychain.id,
        kid: msg.data.kid,
        keys: parsedProducerKeychain.keys,
        eServiceIds: parsedProducerKeychain.eservices,
        version: msg.version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
    .with({ type: "ProducerKeychainEServiceAdded" }, async (msg) => {
      const producerKeychain = msg.data.producerKeychain;
      if (!producerKeychain) {
        throw missingKafkaMessageDataError("producerKeychain", msg.type);
      }

      const parsedProducerKeychain = fromProducerKeychainV2(producerKeychain);

      await upsertProducerKeychainPlatformStatesEntriesByEServiceId({
        producerKeychainId: parsedProducerKeychain.id,
        eServiceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
        keys: parsedProducerKeychain.keys,
        version: msg.version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
    .with({ type: "ProducerKeychainKeyDeleted" }, async (msg) => {
      const producerKeychain = msg.data.producerKeychain;
      if (!producerKeychain) {
        throw missingKafkaMessageDataError("producerKeychain", msg.type);
      }

      const parsedProducerKeychain = fromProducerKeychainV2(producerKeychain);

      // We first upsert the entries touched by this event with the current version.
      // This acts as a per-entry high-water mark: if an older add/update event is
      // consumed later (out-of-order delivery or retry), it will be skipped by the
      // version check in the upsert/delete helpers and won't resurrect stale data.
      await upsertProducerKeychainPlatformStatesEntriesByKid({
        producerKeychainId: parsedProducerKeychain.id,
        kid: msg.data.kid,
        keys: parsedProducerKeychain.keys,
        eServiceIds: parsedProducerKeychain.eservices,
        version: msg.version,
        dynamoDBClient,
        tableName,
        logger,
      });

      await deleteProducerKeychainPlatformStatesEntriesByKid({
        producerKeychainId: parsedProducerKeychain.id,
        kid: msg.data.kid,
        eServiceIds: parsedProducerKeychain.eservices,
        version: msg.version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
    .with({ type: "ProducerKeychainEServiceRemoved" }, async (msg) => {
      const producerKeychain = msg.data.producerKeychain;
      if (!producerKeychain) {
        throw missingKafkaMessageDataError("producerKeychain", msg.type);
      }

      const parsedProducerKeychain = fromProducerKeychainV2(producerKeychain);
      const removedEServiceId = unsafeBrandId<EServiceId>(msg.data.eserviceId);

      // Same rationale as key deletion: write the current event version before
      // deleting, so older events processed later cannot recreate removed entries.
      await upsertProducerKeychainPlatformStatesEntriesByEServiceId({
        producerKeychainId: parsedProducerKeychain.id,
        eServiceId: removedEServiceId,
        keys: parsedProducerKeychain.keys,
        version: msg.version,
        dynamoDBClient,
        tableName,
        logger,
      });

      await deleteProducerKeychainPlatformStatesEntriesByEServiceId({
        producerKeychainId: parsedProducerKeychain.id,
        eServiceId: removedEServiceId,
        kids: parsedProducerKeychain.keys.map((key) => key.kid),
        version: msg.version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
    .with({ type: "ProducerKeychainDeleted" }, async (msg) => {
      const producerKeychain = msg.data.producerKeychain;
      if (!producerKeychain) {
        throw missingKafkaMessageDataError("producerKeychain", msg.type);
      }

      await deleteAllProducerKeychainPlatformStatesEntries({
        producerKeychain: fromProducerKeychainV2(producerKeychain),
        version: msg.version,
        dynamoDBClient,
        tableName,
        logger,
      });
    })
    .with(
      {
        type: P.union(
          "ClientAdded",
          "ClientDeleted",
          "ClientAdminRoleRevoked",
          "ClientAdminSet",
          "ClientAdminRemoved",
          "ClientKeyAdded",
          "ClientKeyDeleted",
          "ClientUserAdded",
          "ClientUserDeleted",
          "ClientPurposeAdded",
          "ClientPurposeRemoved",
          "ProducerKeychainAdded",
          "ProducerKeychainUserAdded",
          "ProducerKeychainUserDeleted"
        ),
      },
      () => Promise.resolve()
    )
    .exhaustive();
}
