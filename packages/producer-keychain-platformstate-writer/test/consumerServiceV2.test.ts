import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import crypto from "crypto";
import {
  getMockContext,
  getMockKey,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import {
  AuthorizationEventEnvelopeV2,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  ProducerKeychainId,
  ProducerKeychain,
  ProducerKeychainEServiceRemovedV2,
  ProducerKeychainKeyAddedV2,
  ProducerKeychainKeyDeletedV2,
  ProducerKeychainDeletedV2,
  ProducerKeychainEServiceAddedV2,
  TenantId,
  UserId,
  toProducerKeychainV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { handleMessageV2 } from "../src/consumerServiceV2.js";

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe("Events V2", () => {
  const tableName = "producer-keychain-platform-states";

  const key = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }).publicKey;

  const base64Key = Buffer.from(
    key.export({ type: "pkcs1", format: "pem" })
  ).toString("base64url");

  it.each([
    "ProducerKeychainNameUpdated",
    "ProducerKeychainDescriptionUpdated",
  ] as const)(
    "%s should not change operational platform state",
    async (type) => {
      const producerKeychain = {
        ...getMockProducerKeychain(),
        name: "Updated name",
        description: "Updated description",
        users: [generateId<UserId>()],
        keys: [getMockKey()],
        eservices: [generateId<EServiceId>()],
      };
      const client = new DynamoDBClient({ region: "eu-south-1" });
      const send = vi
        .spyOn(client, "send")
        .mockRejectedValue(new Error("Unexpected platform-state write"));
      await handleMessageV2(
        {
          sequence_num: 1,
          stream_id: producerKeychain.id,
          version: 2,
          type,
          event_version: 2,
          log_date: new Date(),
          data: { producerKeychain: toProducerKeychainV2(producerKeychain) },
        },
        client,
        tableName,
        getMockContext({}).logger
      );
      expect(send).not.toHaveBeenCalled();
      client.destroy();
    }
  );

  it("ProducerKeychainKeyAdded should upsert platform state entry", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const existingKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };
    const addedKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [eServiceId],
      keys: [existingKey, addedKey],
    };

    const payload: ProducerKeychainKeyAddedV2 = {
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
      kid: addedKey.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 1,
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    const send = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const dynamoDBClient = { send };

    await handleMessageV2(
      message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dynamoDBClient as any,
      tableName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loggerMock as any
    );

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].input.TableName).toBe(tableName);
    const writtenEntry = unmarshall(send.mock.calls[1][0].input.Item);
    expect(writtenEntry.PK).toBe(
      `PRODUCERKEYCHAINKIDESERVICE#${mockProducerKeychain.id}#${addedKey.kid}#${eServiceId}`
    );
    expect(writtenEntry.producerKeychainId).toBe(mockProducerKeychain.id);
    expect(writtenEntry.kid).toBe(addedKey.kid);
    expect(writtenEntry.eServiceId).toBe(eServiceId);
    expect(writtenEntry.publicKey).toBe(addedKey.encodedPem);
    expect(writtenEntry.version).toBe(message.version);
  });

  it("ProducerKeychainKeyAdded should do nothing for stale event", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const mockKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [eServiceId],
      keys: [mockKey],
    };

    const payload: ProducerKeychainKeyAddedV2 = {
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
      kid: mockKey.kid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 2,
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    const existing = {
      PK: `PRODUCERKEYCHAINKIDESERVICE#${mockProducerKeychain.id}#${mockKey.kid}#${eServiceId}`,
      publicKey: mockKey.encodedPem,
      producerKeychainId: mockProducerKeychain.id,
      producerId: generateId<TenantId>(),
      kid: mockKey.kid,
      eServiceId,
      version: 10,
      updatedAt: new Date().toISOString(),
    };
    const send = vi.fn().mockResolvedValueOnce({
      Item: marshall(existing, {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      }),
    });
    const dynamoDBClient = { send };

    await handleMessageV2(
      message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dynamoDBClient as any,
      tableName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loggerMock as any
    );

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("ProducerKeychainDeleted should delete existing up-to-date entry", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const mockKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [eServiceId],
      keys: [mockKey],
    };

    const payload: ProducerKeychainDeletedV2 = {
      producerKeychainId,
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 4,
      type: "ProducerKeychainDeleted",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    const existing = {
      PK: `PRODUCERKEYCHAINKIDESERVICE#${mockProducerKeychain.id}#${mockKey.kid}#${eServiceId}`,
      publicKey: mockKey.encodedPem,
      producerKeychainId: mockProducerKeychain.id,
      producerId: generateId<TenantId>(),
      kid: mockKey.kid,
      eServiceId,
      version: 3,
      updatedAt: new Date().toISOString(),
    };
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Item: marshall(existing, {
          removeUndefinedValues: true,
          convertClassInstanceToMap: true,
        }),
      })
      .mockResolvedValueOnce({});
    const dynamoDBClient = { send };

    await handleMessageV2(
      message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dynamoDBClient as any,
      tableName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loggerMock as any
    );

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].input.TableName).toBe(tableName);
  });

  it("ProducerKeychainEServiceRemoved should delete all entries for removed eservice", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const removedEServiceId: EServiceId = generateId();
    const remainingEServiceId: EServiceId = generateId();
    const mockKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [remainingEServiceId],
      keys: [mockKey],
    };

    const payload: ProducerKeychainEServiceRemovedV2 = {
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
      eserviceId: removedEServiceId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 4,
      type: "ProducerKeychainEServiceRemoved",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    const removedEntry = {
      PK: `PRODUCERKEYCHAINKIDESERVICE#${mockProducerKeychain.id}#${mockKey.kid}#${removedEServiceId}`,
      publicKey: mockKey.encodedPem,
      producerKeychainId: mockProducerKeychain.id,
      producerId: generateId<TenantId>(),
      kid: mockKey.kid,
      eServiceId: removedEServiceId,
      version: 3,
      updatedAt: new Date().toISOString(),
    };

    const send = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Item: marshall(removedEntry, {
          removeUndefinedValues: true,
          convertClassInstanceToMap: true,
        }),
      })
      .mockResolvedValueOnce({});
    const dynamoDBClient = { send };

    await handleMessageV2(
      message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dynamoDBClient as any,
      tableName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loggerMock as any
    );

    expect(send).toHaveBeenCalledTimes(4);
  });

  it("ProducerKeychainKeyDeleted should not upsert unaffected entries", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const eServiceId: EServiceId = generateId();
    const removedKid = generateId();
    const retainedKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };

    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [eServiceId],
      keys: [retainedKey],
    };

    const payload: ProducerKeychainKeyDeletedV2 = {
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
      kid: removedKid,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 1,
      type: "ProducerKeychainKeyDeleted",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    const removedEntry = {
      PK: `PRODUCERKEYCHAINKIDESERVICE#${mockProducerKeychain.id}#${removedKid}#${eServiceId}`,
      publicKey: base64Key,
      producerKeychainId: mockProducerKeychain.id,
      producerId: generateId<TenantId>(),
      kid: removedKid,
      eServiceId,
      version: 0,
      updatedAt: new Date().toISOString(),
    };

    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Item: marshall(removedEntry, {
          removeUndefinedValues: true,
          convertClassInstanceToMap: true,
        }),
      })
      .mockResolvedValueOnce({});
    const dynamoDBClient = { send };

    await handleMessageV2(
      message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dynamoDBClient as any,
      tableName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loggerMock as any
    );

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("ProducerKeychainEServiceAdded should upsert entries only for added eservice", async () => {
    const producerKeychainId: ProducerKeychainId = generateId();
    const existingEServiceId: EServiceId = generateId();
    const addedEServiceId: EServiceId = generateId();
    const mockKey = {
      ...getMockKey(),
      producerKeychainId,
      encodedPem: base64Key,
    };
    const mockProducerKeychain: ProducerKeychain = {
      ...getMockProducerKeychain(),
      id: producerKeychainId,
      eservices: [existingEServiceId, addedEServiceId],
      keys: [mockKey],
    };

    const payload: ProducerKeychainEServiceAddedV2 = {
      producerKeychain: toProducerKeychainV2(mockProducerKeychain),
      eserviceId: addedEServiceId,
    };

    const message: AuthorizationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockProducerKeychain.id,
      version: 1,
      type: "ProducerKeychainEServiceAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    const send = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const dynamoDBClient = { send };

    await handleMessageV2(
      message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dynamoDBClient as any,
      tableName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loggerMock as any
    );

    expect(send).toHaveBeenCalledTimes(2);
    const writtenEntry = unmarshall(send.mock.calls[1][0].input.Item);
    expect(writtenEntry.eServiceId).toBe(addedEServiceId);
  });

  it("ProducerKeychainKeyAdded should fail if payload has no producerKeychain", async () => {
    const message = {
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      type: "ProducerKeychainKeyAdded",
      event_version: 2,
      data: { kid: generateId() },
      log_date: new Date(),
    } as unknown as AuthorizationEventEnvelopeV2;

    const send = vi.fn();
    const dynamoDBClient = { send };

    await expect(
      handleMessageV2(
        message,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dynamoDBClient as any,
        tableName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loggerMock as any
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "producerKeychain",
        "ProducerKeychainKeyAdded"
      )
    );
  });
});
