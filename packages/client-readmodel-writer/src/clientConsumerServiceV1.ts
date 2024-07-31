import { ClientCollection } from "pagopa-interop-commons";
import {
  AuthorizationEventEnvelopeV1,
  fromClientV1,
  fromKeyV1,
  toReadModelClient,
  toReadModelKey,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  clients: ClientCollection
): Promise<void> {
  await match(message)
    .with({ type: "ClientAdded" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $set: {
            data: message.data.client
              ? toReadModelClient(fromClientV1(message.data.client))
              : undefined,
            metadata: {
              version: message.version,
            },
          },
        },
        { upsert: true }
      );
    })
    .with({ type: "RelationshipAdded" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $set: {
            "metadata.version": message.version,
          },
          $push: {
            "data.relationships": message.data.relationshipId,
          },
        }
      );
    })
    .with({ type: "UserAdded" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $set: {
            "metadata.version": message.version,
          },
          $push: {
            "data.users": message.data.userId,
          },
        }
      );
    })
    .with({ type: "UserRemoved" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $set: {
            "metadata.version": message.version,
          },
          $pull: {
            "data.users": message.data.userId,
          },
        }
      );
    })
    .with({ type: "ClientPurposeAdded" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $set: {
            "metadata.version": message.version,
          },
          $push: {
            "data.purposes": message.data.statesChain?.purpose?.purposeId,
          },
        }
      );
    })
    .with({ type: "ClientPurposeRemoved" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $pull: {
            "data.purposes": message.data.purposeId,
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .with({ type: "RelationshipRemoved" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $pull: {
            "data.relationships": message.data.relationshipId,
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .with({ type: "KeysAdded" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $push: {
            "data.keys": {
              $each: message.data.keys
                .map((v) =>
                  v.value
                    ? toReadModelKey(
                        fromKeyV1(v.value, unsafeBrandId(message.data.clientId))
                      )
                    : undefined
                )
                .filter((k) => k !== undefined),
            },
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .with({ type: "KeyDeleted" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $pull: {
            "data.keys": { kid: message.data.keyId },
          },
          $set: {
            "metadata.version": message.version,
          },
        }
      );
    })
    .with({ type: "ClientDeleted" }, async (message) => {
      await clients.deleteOne({
        "data.id": message.stream_id,
        "metadata.version": { $lte: message.version },
      });
    })
    .with({ type: "KeyRelationshipToUserMigrated" }, async (message) => {
      await clients.updateOne(
        {
          "data.id": message.stream_id,
          "metadata.version": { $lte: message.version },
        },
        {
          $set: {
            "data.keys.$[key].userId": message.data.userId,
            "metadata.version": message.version,
          },
        },
        {
          arrayFilters: [
            {
              "key.kid": message.data.keyId,
            },
          ],
        }
      );
    })
    .exhaustive();
}
