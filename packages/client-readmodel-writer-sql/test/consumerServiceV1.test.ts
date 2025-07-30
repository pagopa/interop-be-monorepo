/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe } from "node:test";
import crypto from "crypto";
import {
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test/index.js";
import {
  AuthorizationEventEnvelopeV1,
  Client,
  ClientAddedV1,
  ClientComponentStateV1,
  ClientDeletedV1,
  ClientId,
  ClientPurposeAddedV1,
  ClientPurposeRemovedV1,
  Key,
  KeyDeletedV1,
  KeyRelationshipToUserMigratedV1,
  KeysAddedV1,
  PurposeId,
  RelationshipAddedV1,
  RelationshipRemovedV1,
  UserAddedV1,
  UserId,
  UserRemovedV1,
  generateId,
  toClientV1,
  toKeyV1,
} from "pagopa-interop-models";
import { expect, it } from "vitest";
import { handleMessageV1 } from "../src/clientConsumerServiceV1.js";
import { clientReadModelService, clientWriterService } from "./utils.js";

describe("Events V1", async () => {
  const mockClient = getMockClient();
  const mockMessage: Omit<AuthorizationEventEnvelopeV1, "type" | "data"> = {
    event_version: 1,
    stream_id: mockClient.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
  };

  it("ClientAdded", async () => {
    const payload: ClientAddedV1 = {
      client: toClientV1(mockClient),
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientAdded",
      data: payload,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      mockClient.id
    );

    expect(retrievedClient).toStrictEqual({
      data: mockClient,
      metadata: { version: 1 },
    });
  });
  it("RelationshipAdded", async () => {
    await clientWriterService.upsertClient(mockClient, 1);
    const payload: RelationshipAddedV1 = {
      client: toClientV1(mockClient),
      relationshipId: generateId(),
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "RelationshipAdded",
      data: payload,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      mockClient.id
    );

    expect(retrievedClient).toStrictEqual({
      data: mockClient,
      metadata: { version: 1 },
    });
  });
  it("UserAdded", async () => {
    await clientWriterService.upsertClient(mockClient, 1);

    const userId: UserId = generateId<UserId>();
    const updatedClient: Client = {
      ...mockClient,
      users: [userId],
    };

    const payload: UserAddedV1 = {
      client: toClientV1(updatedClient),
      userId,
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "UserAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      updatedClient.id
    );

    expect(retrievedClient?.data).toStrictEqual(updatedClient);
    expect(retrievedClient?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("UserRemoved", async () => {
    const userId: UserId = generateId<UserId>();
    const client: Client = {
      ...mockClient,
      users: [userId],
    };
    await clientWriterService.upsertClient(client, 1);

    const updatedClient = mockClient;

    const payload: UserRemovedV1 = {
      client: toClientV1(updatedClient),
      userId,
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "UserRemoved",
      data: payload,
      version: 2,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      client.id
    );

    expect(retrievedClient?.data.users).toHaveLength(0);
  });
  it("ClientPurposeAdded", async () => {
    await clientWriterService.upsertClient(mockClient, 1);

    const purposeId: PurposeId = generateId();

    const updatedClient: Client = {
      ...mockClient,
      purposes: [purposeId],
    };

    const payload: ClientPurposeAddedV1 = {
      clientId: updatedClient.id,
      statesChain: {
        id: generateId(),
        purpose: {
          purposeId,
          state: ClientComponentStateV1.ACTIVE,
          versionId: generateId(),
        },
      },
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientPurposeAdded",
      data: payload,
      version: 2,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      updatedClient.id
    );
    expect(retrievedClient?.data).toStrictEqual(updatedClient);
    expect(retrievedClient?.metadata).toStrictEqual({
      version: 2,
    });
  });
  it("ClientPurposeRemoved", async () => {
    const purposeId: PurposeId = generateId<PurposeId>();
    const client: Client = {
      ...mockClient,
      purposes: [purposeId],
    };
    await clientWriterService.upsertClient(client, 1);

    const updatedClient: Client = {
      ...client,
      purposes: [],
    };

    const payload: ClientPurposeRemovedV1 = {
      purposeId,
      clientId: updatedClient.id,
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientPurposeRemoved",
      data: payload,
      version: 2,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      client.id
    );

    expect(retrievedClient?.data.purposes).toHaveLength(0);
  });
  it("RelationshipRemoved", async () => {
    const purposeId: PurposeId = generateId<PurposeId>();
    const client: Client = {
      ...mockClient,
      purposes: [purposeId],
    };
    await clientWriterService.upsertClient(client, 1);

    const updatedClient = mockClient;

    const payload: RelationshipRemovedV1 = {
      clientId: updatedClient.id,
      relationshipId: generateId(),
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "RelationshipRemoved",
      data: payload,
      version: 2,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      client.id
    );

    expect(retrievedClient?.data.purposes).toHaveLength(1);
  });
  it("ClientDeleted", async () => {
    const clientId: ClientId = generateId();
    const payload: ClientDeletedV1 = {
      clientId,
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "ClientDeleted",
      data: payload,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      clientId
    );

    expect(retrievedClient).toBeUndefined();
  });
  it("KeyRelationshipToUserMigrated", async () => {
    const userId: UserId = generateId();
    const key: Key = { ...getMockKey(), userId };

    const updatedClient: Client = {
      ...mockClient,
      keys: [key],
    };

    await clientWriterService.upsertClient(updatedClient, 1);

    const payload: KeyRelationshipToUserMigratedV1 = {
      clientId: updatedClient.id,
      keyId: key.kid,
      userId,
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      type: "KeyRelationshipToUserMigrated",
      data: payload,
      version: 2,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      updatedClient.id
    );

    expect(retrievedClient).toStrictEqual({
      data: updatedClient,
      metadata: { version: 2 },
    });
  });
  describe("KeysAdded", () => {
    it("KeysAdded - RSA", async () => {
      const mockClient: Client = {
        ...getMockClient(),
        keys: [],
      };
      await clientWriterService.upsertClient(mockClient, 1);

      const key = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      }).publicKey;

      const base64Key = Buffer.from(
        key.export({ type: "pkcs1", format: "pem" })
      ).toString("base64url");

      const keyId = generateId();

      const addedKey: Key = {
        ...getMockKey(),
        kid: keyId,
        encodedPem: base64Key,
      };

      const updatedClient: Client = {
        ...mockClient,
        keys: [
          {
            ...addedKey,
          },
        ],
      };
      const payload: KeysAddedV1 = {
        clientId: updatedClient.id,
        keys: [
          {
            keyId,
            value: {
              ...toKeyV1(addedKey),
            },
          },
        ],
      };

      const message: AuthorizationEventEnvelopeV1 = {
        ...mockMessage,
        stream_id: updatedClient.id,
        version: 2,
        type: "KeysAdded",
        data: payload,
      };

      await handleMessageV1(message, clientWriterService);

      const retrievedClient = await clientReadModelService.getClientById(
        updatedClient.id
      );

      expect(retrievedClient).toStrictEqual({
        data: updatedClient,
        metadata: { version: 2 },
      });
    });
  });

  it("KeyDeleted", async () => {
    const mockKey: Key = getMockKey();
    const mockClient: Client = {
      ...getMockClient(),
      keys: [mockKey],
    };
    await clientWriterService.upsertClient(mockClient, 1);

    const payload: KeyDeletedV1 = {
      clientId: mockClient.id,
      keyId: mockKey.kid,
      deactivationTimestamp: "",
    };

    const message: AuthorizationEventEnvelopeV1 = {
      ...mockMessage,
      stream_id: mockClient.id,
      type: "KeyDeleted",
      data: payload,
      version: 2,
    };

    await handleMessageV1(message, clientWriterService);

    const retrievedClient = await clientReadModelService.getClientById(
      mockClient.id
    );
    expect(retrievedClient?.data.keys).toHaveLength(0);
  });
});
